import type { CrmConfig } from "./crm.config";
import { CrmClientError, type CrmErrorCode } from "./crm.errors";
import type {
  CrmClient,
  CrmContact,
  CrmCustomerContext,
  CrmCustomerSummary,
  CrmFollowUp,
  CrmOpportunity
} from "./crm.types";

type FetchResponse = { ok: boolean; status: number; json?: () => Promise<unknown> };
export type CrmFetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

export class ExternalCrmClient implements CrmClient {
  private readonly fetcher: CrmFetcher;

  constructor(private readonly config: CrmConfig, fetcher?: CrmFetcher) {
    this.fetcher = fetcher ?? ((url, init) => fetch(url, init));
  }

  async listCustomers(): Promise<CrmCustomerSummary[]> {
    const [owners, customers] = await Promise.all([
      this.loadOwners(),
      this.loadPagedRecords("/customers")
    ]);
    return customers.map((customer) => mapCustomerSummary(customer, owners)).filter(isDefined);
  }

  getCustomer(customerId: string): Promise<CrmCustomerContext | undefined> {
    return this.getCustomerContext(customerId);
  }

  async getCustomerContext(customerId: string): Promise<CrmCustomerContext | undefined> {
    const encoded = encodeURIComponent(customerId);
    let detail: Record<string, unknown>;
    try {
      detail = await this.loadObject(`/customers/${encoded}`, true);
    } catch (error) {
      if (error instanceof CrmClientError && error.code === "CRM_NOT_FOUND") return undefined;
      throw error;
    }

    const [owners, contacts, followUps, opportunities] = await Promise.all([
      this.loadOwners(),
      this.loadArray(`/customers/${encoded}/contacts`),
      this.loadPagedRecords(`/customers/${encoded}/followups`),
      this.loadPagedRecords(`/opportunities?customerId=${encoded}`)
    ]);
    const summary = mapCustomerSummary(detail, owners);
    if (!summary) throw invalidResponse();

    return {
      ...summary,
      contacts: contacts.map(mapContact).filter(isDefined),
      opportunities: opportunities.map(mapOpportunity).filter(isDefined),
      purchasedProducts: [],
      followUps: followUps.map((item) => mapFollowUp(item, owners)).filter(isDefined)
    };
  }

  private async loadOwners(): Promise<Map<string, string>> {
    const rows = await this.loadArray("/users/options");
    return new Map(
      rows
        .map((row) => [stringValue(row.id), stringValue(row.name)] as const)
        .filter(([id, name]) => Boolean(id && name))
    );
  }

  private async loadPagedRecords(path: string): Promise<Record<string, unknown>[]> {
    const first = await this.loadPage(path, 1);
    const rows = [...first.rows];
    for (let page = 2; page <= first.totalPages; page += 1) {
      rows.push(...(await this.loadPage(path, page)).rows);
    }
    return rows;
  }

  private async loadPage(path: string, page: number) {
    const body = recordValue(await this.request(withPagination(path, page)));
    if (!body || !Array.isArray(body.data)) throw invalidResponse();
    const meta = recordValue(body.meta);
    const totalPages = meta?.totalPages;
    if (
      typeof totalPages !== "number" ||
      !Number.isInteger(totalPages) ||
      totalPages < 1 ||
      totalPages > MAX_PAGES
    ) {
      throw invalidResponse();
    }
    return { rows: body.data.map(recordValue).filter(isDefined), totalPages };
  }

  private async loadArray(path: string): Promise<Record<string, unknown>[]> {
    const body = recordValue(await this.request(path));
    if (!body || !Array.isArray(body.data)) throw invalidResponse();
    return body.data.map(recordValue).filter(isDefined);
  }

  private async loadObject(path: string, allowNotFound = false): Promise<Record<string, unknown>> {
    const body = recordValue(await this.request(path, allowNotFound));
    const data = recordValue(body?.data);
    if (!data) throw invalidResponse();
    return data;
  }

  private async request(path: string, allowNotFound = false): Promise<unknown> {
    let response: FetchResponse;
    try {
      response = await this.fetcher(`${this.config.baseUrl}${path}`, {
        method: "GET",
        redirect: "error",
        headers: { Accept: "application/json", Authorization: `Bearer ${this.config.apiToken}` },
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        throw new CrmClientError("CRM_UNAVAILABLE", "CRM request timed out");
      }
      throw new CrmClientError("CRM_UNAVAILABLE", "CRM is unavailable");
    }
    if (!response.ok) throw httpError(response.status, allowNotFound);
    try {
      return await response.json?.();
    } catch {
      throw invalidResponse();
    }
  }
}

function withPagination(path: string, page: number): string {
  const queryIndex = path.indexOf("?");
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const rawQuery = queryIndex === -1 ? "" : path.slice(queryIndex + 1);
  const params = new URLSearchParams(rawQuery);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  return `${pathname}?${params.toString()}`;
}

function mapCustomerSummary(row: Record<string, unknown>, owners: Map<string, string>): CrmCustomerSummary | undefined {
  const customerId = stringValue(row.id);
  const name = stringValue(row.name);
  if (!customerId || !name) return undefined;
  const ownerId = stringValue(row.ownerId);
  return {
    customerId,
    name,
    industry: stringValue(row.industry),
    region: stringValue(row.region),
    accountOwner: owners.get(ownerId) || ownerId
  };
}

function mapContact(row: Record<string, unknown>): CrmContact | undefined {
  const name = stringValue(row.name);
  if (!name) return undefined;
  return {
    name,
    title: stringValue(row.title) || stringValue(row.department),
    role: row.isKeyPerson === true ? "decision_maker" : row.isTechContact === true ? "technical_evaluator" : "business_user"
  };
}

function mapOpportunity(row: Record<string, unknown>): CrmOpportunity | undefined {
  const opportunityId = stringValue(row.id);
  const name = stringValue(row.name);
  const stage = mapStage(stringValue(row.stage));
  if (!opportunityId || !name || !stage) return undefined;
  return {
    opportunityId,
    name,
    stage,
    estimatedValue: opportunityAmount(row.estimatedAmount),
    expectedCloseDate: validDatePrefix(row.estimatedCloseAt)
  };
}

function opportunityAmount(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string" || !value.trim()) return 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function validDatePrefix(value: unknown): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(stringValue(value));
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];
  if (maxDay === undefined || day < 1 || day > maxDay) return "";
  return match[0];
}

function mapStage(value: string): CrmOpportunity["stage"] | undefined {
  if (["INITIAL_CONTACT", "VISITED", "NEEDS_CONFIRMED"].includes(value)) return "discovery";
  if (["SOLUTION_SHARED", "POC_TEST", "QUOTING"].includes(value)) return "proposal";
  if (["BUSINESS_ADVANCING", "PENDING_SIGN"].includes(value)) return "negotiation";
  if (value === "WON") return "won";
  return undefined;
}

function mapFollowUp(row: Record<string, unknown>, owners: Map<string, string>): CrmFollowUp | undefined {
  const happenedAt = stringValue(row.followupAt);
  const summary = stringValue(row.content);
  if (!happenedAt || !summary) return undefined;
  const ownerId = stringValue(row.createdBy);
  return { happenedAt, owner: owners.get(ownerId) || ownerId, summary };
}

function httpError(status: number, allowNotFound: boolean): CrmClientError {
  const code: CrmErrorCode =
    status === 401 || status === 403
      ? "CRM_AUTHENTICATION_FAILED"
      : status === 404 && allowNotFound
        ? "CRM_NOT_FOUND"
        : status === 429
          ? "CRM_RATE_LIMITED"
          : status >= 500
            ? "CRM_UNAVAILABLE"
            : "CRM_REQUEST_REJECTED";
  return new CrmClientError(code, "CRM request failed", status);
}

function invalidResponse(): CrmClientError {
  return new CrmClientError("CRM_RESPONSE_INVALID", "CRM returned an invalid response");
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
