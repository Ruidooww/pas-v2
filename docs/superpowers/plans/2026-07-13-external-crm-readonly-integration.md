# External CRM Read-Only Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reserved external CRM mode with a production-safe read-only adapter for `https://demo.sworditsys.com`, while preserving mock mode and the existing PAS customer contracts.

**Architecture:** Extend `CrmConfig`, add a fetch-injected `ExternalCrmClient`, and select it behind the existing `CRM_CLIENT` token. The adapter paginates fixed read endpoints, validates untrusted payloads, maps CRM records into `CrmCustomerContext`, and never exposes a mutation method. The controller adds source metadata and sanitized upstream error mapping; the frontend renders source-aware customer copy without receiving CRM credentials.

**Tech Stack:** TypeScript 6, Node.js 22 native `fetch`, NestJS 11, Vitest 4, React 19, Ant Design 6, Docker Compose, pnpm 11.

## Global Constraints

- CRM access is read-only: the adapter may issue only HTTP `GET` requests.
- The only approved external origin is `https://demo.sworditsys.com/api/v1`.
- `CRM_API_TOKEN` remains backend-only, is never committed, persisted, logged, audited, or returned to the frontend.
- External failure never falls back to mock customers.
- First-release reads are limited to customers, customer details, contacts, follow-ups, opportunities, and `/users/options`.
- `purchasedProducts` remains an empty array.
- `PAUSED`, `LOST`, `CLOSED`, and unknown opportunity stages are excluded from the active PAS context.
- Do not add an HTTP client dependency; use Node.js native `fetch` with an injectable fetcher.
- CI tests must not call the live CRM or contain a live token.
- Every code task follows TDD and commits only its listed files.

---

## File Map

### Create

- `apps/backend/src/crm/crm.errors.ts`: stable external CRM error codes and sanitized error class.
- `apps/backend/src/crm/external-crm.client.ts`: fixed-path read-only transport, pagination, validation, and CRM-to-PAS mapping.
- `apps/backend/src/crm/external-crm.client.spec.ts`: transport, pagination, mapping, and failure unit tests.
- `apps/backend/src/crm/external-crm.client.integration.spec.ts`: local HTTP server proof that the real transport sends only `GET`.
- `apps/backend/src/crm/crm.module.spec.ts`: mock/external provider selection tests.

### Modify

- `apps/backend/src/crm/crm.config.ts`: external URL, token, and timeout configuration.
- `apps/backend/src/crm/crm.config.spec.ts`: configuration validation tests.
- `apps/backend/src/crm/crm.module.ts`: construct the selected client.
- `apps/backend/src/crm/mock-crm.client.ts`: make mock mode a dedicated client with no external-mode branch.
- `apps/backend/src/crm/mock-crm.client.spec.ts`: preserve mock behavior after constructor simplification.
- `apps/backend/src/crm/crm.controller.ts`: source metadata and sanitized HTTP error mapping.
- `apps/backend/src/crm/crm.controller.spec.ts`: source and error contract tests.
- `apps/frontend/src/customer-api.ts`: cache and return customer source with customer rows.
- `apps/frontend/src/pages/CustomerManagementPage.tsx`: source-aware labels, status, and empty state.
- `apps/frontend/src/pages/CustomerManagementPage.test.tsx`: external/mock rendering and shared-cache tests.
- `apps/frontend/src/pages/WorkbenchPage.tsx`: consume the new customer-list result shape.
- `.env.example`: document non-secret CRM settings and an empty token.
- `docker-compose.yml`: forward CRM settings to `pas-backend`.

---

### Task 1: CRM Configuration And Error Contract

**Files:**
- Create: `apps/backend/src/crm/crm.errors.ts`
- Modify: `apps/backend/src/crm/crm.config.ts`
- Modify: `apps/backend/src/crm/crm.config.spec.ts`
- Modify: `apps/backend/src/crm/mock-crm.client.spec.ts`

**Interfaces:**
- Produces: `CrmConfig { clientMode, baseUrl, apiToken, timeoutMs }`.
- Produces: `CrmClientError`, `CrmErrorCode`, and `upstreamStatus` for Tasks 2 and 3.
- Consumes: environment variables `CRM_CLIENT_MODE`, `CRM_BASE_URL`, `CRM_API_TOKEN`, and `CRM_TIMEOUT_MS`.

- [ ] **Step 1: Write failing external configuration tests**

Replace the external-mode expectation and add validation cases in
`crm.config.spec.ts`:

```ts
it("uses safe mock defaults", () => {
  expect(createCrmConfig({})).toEqual({
    clientMode: "mock",
    baseUrl: "",
    apiToken: "",
    timeoutMs: 10000
  });
});

it("loads the approved external CRM configuration", () => {
  expect(
    createCrmConfig({
      CRM_CLIENT_MODE: "external",
      CRM_BASE_URL: "https://demo.sworditsys.com/api/v1/",
      CRM_API_TOKEN: "test-token",
      CRM_TIMEOUT_MS: "12000"
    })
  ).toEqual({
    clientMode: "external",
    baseUrl: "https://demo.sworditsys.com/api/v1",
    apiToken: "test-token",
    timeoutMs: 12000
  });
});

it.each([
  [{ CRM_CLIENT_MODE: "external", CRM_API_TOKEN: "test-token" }, "CRM_BASE_URL"],
  [
    {
      CRM_CLIENT_MODE: "external",
      CRM_BASE_URL: "https://demo.sworditsys.com/api/v1",
      CRM_API_TOKEN: ""
    },
    "CRM_API_TOKEN"
  ],
  [
    {
      CRM_CLIENT_MODE: "external",
      CRM_BASE_URL: "http://demo.sworditsys.com/api/v1",
      CRM_API_TOKEN: "test-token"
    },
    "CRM_BASE_URL"
  ],
  [
    {
      CRM_CLIENT_MODE: "external",
      CRM_BASE_URL: "https://example.com/api/v1",
      CRM_API_TOKEN: "test-token"
    },
    "CRM_BASE_URL"
  ],
  [
    {
      CRM_CLIENT_MODE: "external",
      CRM_BASE_URL: "https://demo.sworditsys.com/api/v1?redirect=x",
      CRM_API_TOKEN: "test-token"
    },
    "CRM_BASE_URL"
  ],
  [
    {
      CRM_CLIENT_MODE: "external",
      CRM_BASE_URL: "https://demo.sworditsys.com/api/v1",
      CRM_API_TOKEN: "test-token",
      CRM_TIMEOUT_MS: "999"
    },
    "CRM_TIMEOUT_MS"
  ]
])("rejects invalid external configuration %#", (env, expectedField) => {
  expect(() => createCrmConfig(env)).toThrow(expectedField);
});
```

Update `mock-crm.client.spec.ts` constructor inputs to use
`createCrmConfig({})`; this keeps the focused test type-correct after the config
shape expands.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/crm/crm.config.spec.ts src/crm/mock-crm.client.spec.ts
```

Expected: FAIL because `CrmConfig` does not expose `baseUrl`, `apiToken`, or
`timeoutMs`, and external validation is absent.

- [ ] **Step 3: Implement the exact configuration policy**

Replace `crm.config.ts` with:

```ts
export type CrmClientMode = "mock" | "external";

export type CrmConfig = {
  clientMode: CrmClientMode;
  baseUrl: string;
  apiToken: string;
  timeoutMs: number;
};

type CrmEnv = Partial<
  Record<"CRM_CLIENT_MODE" | "CRM_BASE_URL" | "CRM_API_TOKEN" | "CRM_TIMEOUT_MS", string>
>;

const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

export function createCrmConfig(env: CrmEnv = process.env): CrmConfig {
  const clientMode = env.CRM_CLIENT_MODE?.trim() === "external" ? "external" : "mock";
  const timeoutMs = parseTimeout(env.CRM_TIMEOUT_MS);
  if (clientMode === "mock") {
    return { clientMode, baseUrl: "", apiToken: "", timeoutMs };
  }

  return {
    clientMode,
    baseUrl: normalizeExternalBaseUrl(env.CRM_BASE_URL),
    apiToken: required(env.CRM_API_TOKEN, "CRM_API_TOKEN"),
    timeoutMs
  };
}

function normalizeExternalBaseUrl(value: string | undefined): string {
  const raw = required(value, "CRM_BASE_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CRM_BASE_URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "demo.sworditsys.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/+$/, "") !== "/api/v1"
  ) {
    throw new Error("CRM_BASE_URL must be https://demo.sworditsys.com/api/v1");
  }
  return "https://demo.sworditsys.com/api/v1";
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim() || "";
  if (!normalized) throw new Error(`${name} is required in external mode`);
  return normalized;
}

function parseTimeout(value: string | undefined): number {
  const timeoutMs = value === undefined || value.trim() === "" ? DEFAULT_TIMEOUT_MS : Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`CRM_TIMEOUT_MS must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}`);
  }
  return timeoutMs;
}
```

Create `crm.errors.ts`:

```ts
export type CrmErrorCode =
  | "CRM_AUTHENTICATION_FAILED"
  | "CRM_NOT_FOUND"
  | "CRM_RATE_LIMITED"
  | "CRM_UNAVAILABLE"
  | "CRM_RESPONSE_INVALID"
  | "CRM_REQUEST_REJECTED";

export class CrmClientError extends Error {
  constructor(
    readonly code: CrmErrorCode,
    message: string,
    readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = "CrmClientError";
  }
}
```

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/crm/crm.config.spec.ts src/crm/mock-crm.client.spec.ts
pnpm --filter pas-backend typecheck
```

Expected: both CRM test files PASS and backend typecheck exits 0.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- apps/backend/src/crm/crm.config.ts apps/backend/src/crm/crm.config.spec.ts apps/backend/src/crm/crm.errors.ts apps/backend/src/crm/mock-crm.client.spec.ts
git commit -m "feat: validate external CRM configuration"
```

---

### Task 2: External CRM Read Client And Mapping

**Files:**
- Create: `apps/backend/src/crm/external-crm.client.ts`
- Create: `apps/backend/src/crm/external-crm.client.spec.ts`

**Interfaces:**
- Consumes: `CrmConfig`, `CrmClientError`, and the existing `CrmClient` DTO types.
- Produces: `ExternalCrmClient implements CrmClient` with constructor
  `new ExternalCrmClient(config: CrmConfig, fetcher?: CrmFetcher)`.
- Produces: only fixed `GET` requests to customers, contacts, follow-ups,
  opportunities, and user options.

- [ ] **Step 1: Write failing pagination and read-only transport tests**

Create `external-crm.client.spec.ts` with a route-based fetch mock. The first
test must verify all customer pages, owner resolution, authorization, redirects,
timeout signal, and HTTP method:

```ts
import { describe, expect, it, vi } from "vitest";
import type { CrmConfig } from "./crm.config";
import { CrmClientError } from "./crm.errors";
import { ExternalCrmClient } from "./external-crm.client";

const config: CrmConfig = {
  clientMode: "external",
  baseUrl: "https://demo.sworditsys.com/api/v1",
  apiToken: "test-token",
  timeoutMs: 10000
};

it("reads every customer page with GET and resolves owner names", async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/users/options")) {
      return jsonResponse(200, { success: true, data: [{ id: "user-1", name: "Alice" }] });
    }
    if (url.includes("page=1")) {
      return jsonResponse(200, {
        success: true,
        data: [{ id: "customer-1", name: "Acme", industry: "制造", region: "华东", ownerId: "user-1" }],
        meta: { total: 2, page: 1, pageSize: 1, totalPages: 2 }
      });
    }
    return jsonResponse(200, {
      success: true,
      data: [{ id: "customer-2", name: "Beta", industry: "金融", region: "华南", ownerId: "missing" }],
      meta: { total: 2, page: 2, pageSize: 1, totalPages: 2 }
    });
  });

  const customers = await new ExternalCrmClient(config, fetcher).listCustomers();

  expect(customers).toEqual([
    { customerId: "customer-1", name: "Acme", industry: "制造", region: "华东", accountOwner: "Alice" },
    { customerId: "customer-2", name: "Beta", industry: "金融", region: "华南", accountOwner: "missing" }
  ]);
  for (const [, init] of fetcher.mock.calls) {
    expect(init).toMatchObject({ method: "GET", redirect: "error" });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(init?.body).toBeUndefined();
    expect(init?.signal).toBeDefined();
  }
});
```

Use this test helper at the bottom of the file:

```ts
function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}
```

- [ ] **Step 2: Write failing customer-context mapping tests**

Add a test whose fetcher returns one detail, contact, follow-up, opportunity,
and user option. Assert the approved mapping and inactive-stage exclusion:

```ts
it("maps customer context and excludes inactive opportunities", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/users/options")) {
      return jsonResponse(200, { data: [{ id: "user-1", name: "Alice" }] });
    }
    if (url.endsWith("/customers/customer-1")) {
      return jsonResponse(200, {
        data: { id: "customer-1", name: "Acme", industry: "制造", region: "华东", ownerId: "user-1" }
      });
    }
    if (url.endsWith("/customers/customer-1/contacts")) {
      return jsonResponse(200, {
        data: [
          { name: "Decision", title: "CIO", isKeyPerson: true, isTechContact: false },
          { name: "Technical", department: "IT", isKeyPerson: false, isTechContact: true }
        ]
      });
    }
    if (url.includes("/customers/customer-1/followups")) {
      return jsonResponse(200, {
        data: [{ followupAt: "2026-07-12T08:00:00.000Z", createdBy: "user-1", content: "Confirmed requirements" }],
        meta: { totalPages: 1 }
      });
    }
    return jsonResponse(200, {
      data: [
        { id: "opp-1", name: "DLP", stage: "POC_TEST", estimatedAmount: "380000.50", estimatedCloseAt: "2026-09-30T00:00:00.000Z" },
        { id: "opp-2", name: "Paused", stage: "PAUSED", estimatedAmount: "10", estimatedCloseAt: "2026-10-01" },
        { id: "opp-3", name: "Future", stage: "NEW_STAGE", estimatedAmount: "10", estimatedCloseAt: "2026-10-01" }
      ],
      meta: { totalPages: 1 }
    });
  });

  const context = await new ExternalCrmClient(config, fetcher).getCustomerContext("customer-1");

  expect(context).toEqual({
    customerId: "customer-1",
    name: "Acme",
    industry: "制造",
    region: "华东",
    accountOwner: "Alice",
    contacts: [
      { name: "Decision", title: "CIO", role: "decision_maker" },
      { name: "Technical", title: "IT", role: "technical_evaluator" }
    ],
    opportunities: [
      { opportunityId: "opp-1", name: "DLP", stage: "proposal", estimatedValue: 380000.5, expectedCloseDate: "2026-09-30" }
    ],
    purchasedProducts: [],
    followUps: [{ happenedAt: "2026-07-12T08:00:00.000Z", owner: "Alice", summary: "Confirmed requirements" }]
  });
});
```

- [ ] **Step 3: Write failing error and invalid-response tests**

Add table-driven HTTP tests and a malformed-root test:

Only the customer detail request treats HTTP 404 as a missing customer. Every non-detail 404 is a rejected CRM request.

```ts
it.each([
  [401, "CRM_AUTHENTICATION_FAILED"],
  [403, "CRM_AUTHENTICATION_FAILED"],
  [429, "CRM_RATE_LIMITED"],
  [500, "CRM_UNAVAILABLE"],
  [400, "CRM_REQUEST_REJECTED"]
] as const)("maps HTTP %i to %s", async (status, code) => {
  const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, { secret: "must-not-leak" }));
  const promise = new ExternalCrmClient(config, fetcher).getCustomerContext("customer-1");
  await expect(promise).rejects.toMatchObject({ code, upstreamStatus: status });
  await expect(promise).rejects.not.toThrow("must-not-leak");
});

it("returns undefined when the customer detail is missing", async () => {
  const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, { secret: "must-not-leak" }));
  await expect(
    new ExternalCrmClient(config, fetcher).getCustomerContext("customer-1")
  ).resolves.toBeUndefined();
});

it("maps a non-detail HTTP 404 to CRM_REQUEST_REJECTED", async () => {
  const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, { secret: "must-not-leak" }));
  await expect(new ExternalCrmClient(config, fetcher).listCustomers()).rejects.toMatchObject({
    code: "CRM_REQUEST_REJECTED",
    upstreamStatus: 404
  });
});

it("rejects a structurally invalid customer list", async () => {
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/users/options")
      ? jsonResponse(200, { data: [] })
      : jsonResponse(200, { data: { items: [] } })
  );
  await expect(new ExternalCrmClient(config, fetcher).listCustomers()).rejects.toMatchObject({
    code: "CRM_RESPONSE_INVALID"
  });
});

it("maps timeout and invalid JSON without leaking transport details", async () => {
  const timeout = Object.assign(new Error("socket detail"), { name: "TimeoutError" });
  await expect(
    new ExternalCrmClient(config, vi.fn().mockRejectedValue(timeout)).listCustomers()
  ).rejects.toMatchObject({ code: "CRM_UNAVAILABLE", message: "CRM request timed out" });

  const invalidJson = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new Error("raw response detail");
    }
  });
  await expect(new ExternalCrmClient(config, invalidJson).listCustomers()).rejects.toMatchObject({
    code: "CRM_RESPONSE_INVALID",
    message: "CRM returned an invalid response"
  });
});

it("rejects pagination above the bounded maximum", async () => {
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/users/options")
      ? jsonResponse(200, { data: [] })
      : jsonResponse(200, { data: [], meta: { totalPages: 101 } })
  );
  await expect(new ExternalCrmClient(config, fetcher).listCustomers()).rejects.toMatchObject({
    code: "CRM_RESPONSE_INVALID"
  });
});
```

- [ ] **Step 4: Run the new test and verify RED**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/crm/external-crm.client.spec.ts
```

Expected: FAIL because `ExternalCrmClient` does not exist.

- [ ] **Step 5: Implement the read-only client**

Create `external-crm.client.ts` with these exact boundaries:

```ts
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
    const totalPages = meta ? numberValue(meta.totalPages) ?? 1 : 1;
    if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > MAX_PAGES) throw invalidResponse();
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
```

Add the concrete helpers in the same file; do not export them:

```ts
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
  const amount = Number(row.estimatedAmount);
  const rawDate = stringValue(row.estimatedCloseAt);
  return {
    opportunityId,
    name,
    stage,
    estimatedValue: Number.isFinite(amount) ? amount : 0,
    expectedCloseDate: /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : ""
  };
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

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
pnpm --filter pas-backend exec vitest run src/crm/external-crm.client.spec.ts
pnpm --filter pas-backend typecheck
```

Expected: external client tests PASS and backend typecheck exits 0.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- apps/backend/src/crm/external-crm.client.ts apps/backend/src/crm/external-crm.client.spec.ts
git commit -m "feat: add read-only external CRM client"
```

---

### Task 3: Module Selection, Controller Contract, And Transport Integration

**Files:**
- Create: `apps/backend/src/crm/crm.module.spec.ts`
- Create: `apps/backend/src/crm/external-crm.client.integration.spec.ts`
- Modify: `apps/backend/src/crm/crm.module.ts`
- Modify: `apps/backend/src/crm/mock-crm.client.ts`
- Modify: `apps/backend/src/crm/mock-crm.client.spec.ts`
- Modify: `apps/backend/src/crm/crm.controller.ts`
- Modify: `apps/backend/src/crm/crm.controller.spec.ts`

**Interfaces:**
- Consumes: `ExternalCrmClient`, `MockCrmClient`, `CrmConfig`, and `CrmClientError`.
- Produces: `createCrmClient(config): CrmClient` for testable provider selection.
- Produces: `GET /api/crm/customers` response `{ source, customers }`.
- Produces: sanitized HTTP 404, 502, and 503 responses for CRM failures.

- [ ] **Step 1: Write failing client-selection tests**

Create `crm.module.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ExternalCrmClient } from "./external-crm.client";
import { MockCrmClient } from "./mock-crm.client";
import { createCrmClient } from "./crm.module";

describe("createCrmClient", () => {
  it("creates the dedicated mock client", () => {
    expect(
      createCrmClient({ clientMode: "mock", baseUrl: "", apiToken: "", timeoutMs: 10000 })
    ).toBeInstanceOf(MockCrmClient);
  });

  it("creates the external client without mock fallback", () => {
    expect(
      createCrmClient({
        clientMode: "external",
        baseUrl: "https://demo.sworditsys.com/api/v1",
        apiToken: "test-token",
        timeoutMs: 10000
      })
    ).toBeInstanceOf(ExternalCrmClient);
  });
});
```

- [ ] **Step 2: Write failing controller source and error tests**

Update every `new CrmController(client)` in `crm.controller.spec.ts` to pass a
mock config. Extend the list expectation and add sanitized error cases:

```ts
const mockConfig = { clientMode: "mock", baseUrl: "", apiToken: "", timeoutMs: 10000 } as const;
const externalConfig = {
  clientMode: "external",
  baseUrl: "https://demo.sworditsys.com/api/v1",
  apiToken: "test-token",
  timeoutMs: 10000
} as const;

expect(await new CrmController(client, externalConfig).listCustomers()).toEqual({
  source: "external",
  customers: [expect.objectContaining({ customerId: customerContext.customerId })]
});

it.each([
  ["CRM_AUTHENTICATION_FAILED", 502],
  ["CRM_RESPONSE_INVALID", 502],
  ["CRM_REQUEST_REJECTED", 502],
  ["CRM_RATE_LIMITED", 503],
  ["CRM_UNAVAILABLE", 503]
] as const)("maps %s to HTTP %i", async (code, status) => {
  const client = {
    listCustomers: vi.fn().mockRejectedValue(new CrmClientError(code, "sanitized", 500))
  } as unknown as CrmClient;
  try {
    await new CrmController(client, externalConfig).listCustomers();
    expect.unreachable("Expected controller to reject");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    expect((error as HttpException).getResponse()).toMatchObject({ code });
  }
});
```

Import `HttpException` and `CrmClientError`. Ensure the existing missing-customer
case still returns 404.

- [ ] **Step 3: Run module and controller tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/crm/crm.module.spec.ts src/crm/crm.controller.spec.ts
```

Expected: FAIL because `createCrmClient`, external selection, source metadata,
and upstream error mapping do not exist.

- [ ] **Step 4: Implement client selection and simplify mock mode**

Change `MockCrmClient` to take no config and remove `assertMockMode`. Update its
tests to use `new MockCrmClient()` and delete the obsolete external-mode failure
test.

Add this factory to `crm.module.ts` and use it in the provider:

```ts
import { ExternalCrmClient } from "./external-crm.client";

export function createCrmClient(config: CrmConfig): CrmClient {
  return config.clientMode === "external" ? new ExternalCrmClient(config) : new MockCrmClient();
}

// CRM_CLIENT provider
{
  provide: CRM_CLIENT,
  useFactory: createCrmClient,
  inject: [CRM_CONFIG]
}
```

- [ ] **Step 5: Implement controller source and sanitized errors**

Inject `CRM_CONFIG` into `CrmController`. Wrap all three client calls with the
same `execute` helper:

```ts
import {
  BadGatewayException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ServiceUnavailableException
} from "@nestjs/common";
import type { CrmConfig } from "./crm.config";
import { CrmClientError } from "./crm.errors";
import { CRM_CLIENT, CRM_CONFIG } from "./crm.tokens";

type CustomerListResponse = {
  source: CrmConfig["clientMode"];
  customers: CrmCustomerSummary[];
};

constructor(
  @Inject(CRM_CLIENT) private readonly crmClient: CrmClient,
  @Inject(CRM_CONFIG) private readonly crmConfig: CrmConfig
) {}

async listCustomers(): Promise<CustomerListResponse> {
  return this.execute(async () => ({
    source: this.crmConfig.clientMode,
    customers: await this.crmClient.listCustomers()
  }));
}

private async execute<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof CrmClientError)) throw error;
    const body = { code: error.code, message: crmPublicMessage(error) };
    if (error.code === "CRM_RATE_LIMITED" || error.code === "CRM_UNAVAILABLE") {
      throw new ServiceUnavailableException(body);
    }
    if (error.code === "CRM_NOT_FOUND") {
      throw new NotFoundException(body);
    }
    throw new BadGatewayException(body);
  }
}
```

Use this message mapper outside the class:

```ts
function crmPublicMessage(error: CrmClientError): string {
  if (error.code === "CRM_AUTHENTICATION_FAILED") return "CRM authentication or scope is invalid";
  if (error.code === "CRM_RATE_LIMITED") return "CRM request limit reached";
  if (error.code === "CRM_NOT_FOUND") return "Customer not found";
  if (error.code === "CRM_RESPONSE_INVALID") return "CRM returned an invalid response";
  if (error.code === "CRM_REQUEST_REJECTED") return "CRM rejected the request";
  return "CRM is temporarily unavailable";
}
```

Call `this.execute` from `getCustomer` and `getCustomerContext` while retaining
their explicit `undefined` to `NotFoundException` behavior.

- [ ] **Step 6: Add a local-server GET-only integration test**

Create `external-crm.client.integration.spec.ts` using `node:http`. Start a
server on `127.0.0.1` with an ephemeral port, return valid JSON for
`/users/options` and `/customers`, and record `request.method`. Instantiate
`ExternalCrmClient` directly with the local base URL and native fetch:

```ts
it("uses only GET against a real HTTP transport", async () => {
  const methods: string[] = [];
  const server = createServer((request, response) => {
    methods.push(request.method || "");
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify(
        request.url === "/users/options"
          ? { data: [{ id: "user-1", name: "Alice" }] }
          : {
              data: [{ id: "customer-1", name: "Acme", industry: "制造", region: "华东", ownerId: "user-1" }],
              meta: { totalPages: 1 }
            }
      )
    );
  });
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  try {
    const client = new ExternalCrmClient({
      clientMode: "external",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiToken: "test-token",
      timeoutMs: 10000
    });
    await expect(client.listCustomers()).resolves.toHaveLength(1);
    expect(methods).toEqual(["GET", "GET"]);
  } finally {
    await close(server);
  }
});
```

Add these Promise wrappers in the integration test; do not add a package
dependency:

```ts
import { createServer, type Server } from "node:http";

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
```

- [ ] **Step 7: Run CRM tests and backend typecheck**

```powershell
pnpm --filter pas-backend exec vitest run src/crm
pnpm --filter pas-backend typecheck
```

Expected: all CRM tests PASS and backend typecheck exits 0.

- [ ] **Step 8: Commit Task 3**

```powershell
git add -- apps/backend/src/crm/crm.module.ts apps/backend/src/crm/crm.module.spec.ts apps/backend/src/crm/mock-crm.client.ts apps/backend/src/crm/mock-crm.client.spec.ts apps/backend/src/crm/crm.controller.ts apps/backend/src/crm/crm.controller.spec.ts apps/backend/src/crm/external-crm.client.integration.spec.ts
git commit -m "feat: wire external CRM mode"
```

---

### Task 4: Source-Aware Customer Frontend

**Files:**
- Modify: `apps/frontend/src/customer-api.ts`
- Modify: `apps/frontend/src/pages/CustomerManagementPage.tsx`
- Modify: `apps/frontend/src/pages/CustomerManagementPage.test.tsx`
- Modify: `apps/frontend/src/pages/WorkbenchPage.tsx`

**Interfaces:**
- Consumes: backend `{ source: "mock" | "external", customers: CrmCustomerSummary[] }`.
- Produces: cached `CustomerListResult` shared by customer management and workbench.
- Produces: external labels `CRM 客户池` and `CRM 数据`; mock labels remain sample-specific.

- [ ] **Step 1: Write failing source-aware rendering tests**

Replace the first page test with explicit mock metadata, then add an external
case:

```tsx
it("explains the mock customer pool when no rows are available", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ source: "mock", customers: [] })));
  render(<CustomerManagementPage />);
  expect(await screen.findByText("暂无客户样例")).toBeInTheDocument();
  expect(screen.getByText("当前使用假数据；真实 CRM API 接好后会自动展示客户池。")).toBeInTheDocument();
});

it("labels external customer data without sample wording", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse({
        source: "external",
        customers: [
          { customerId: "customer-1", name: "Acme", industry: "制造", region: "华东", accountOwner: "Alice" }
        ]
      })
    )
  );
  render(<CustomerManagementPage />);
  expect(await screen.findByText("Acme")).toBeInTheDocument();
  expect(screen.getAllByText("CRM 数据").length).toBeGreaterThan(0);
  expect(screen.getByText(/CRM 客户池/)).toBeInTheDocument();
  expect(screen.queryByText("样例")).not.toBeInTheDocument();
});
```

Update all test customer-list responses to include `source: "mock"`. Preserve
the assertion that customer management and `WorkbenchPage` share one request.

- [ ] **Step 2: Run the page test and verify RED**

```powershell
pnpm --filter pas-frontend exec vitest run src/pages/CustomerManagementPage.test.tsx
```

Expected: FAIL because `loadCustomers` discards source metadata and the page
always renders sample copy.

- [ ] **Step 3: Return and cache the customer source**

Change `customer-api.ts` to export and cache the result object:

```ts
export type CustomerListResult = {
  source: "mock" | "external";
  customers: CrmCustomerSummary[];
};

type CustomerCacheEntry = {
  token: string | null;
  promise: Promise<CustomerListResult>;
};

export function loadCustomers(): Promise<CustomerListResult> {
  const token = getToken();
  if (customerCache?.token === token) return customerCache.promise;
  const promise = api<CustomerListResult>("/api/crm/customers");
  customerCache = { token, promise };
  void promise.catch(() => {
    if (customerCache?.promise === promise) customerCache = null;
  });
  return promise;
}
```

Update `WorkbenchPage.tsx`:

```ts
loadCustomers()
  .then(({ customers }) => setCustomers(customers))
  .catch((err) => setError(err instanceof Error ? err.message : "客户列表加载失败"));
```

- [ ] **Step 4: Render source-aware customer copy**

Add `source` state to `CustomerManagementPage` and set it with the rows:

```tsx
const [source, setSource] = useState<"mock" | "external">("mock");

loadCustomers()
  .then((result) => {
    setCustomers(result.customers);
    setSource(result.source);
  })
  .catch((err) => setError(err instanceof Error ? err.message : "客户列表加载失败"));

const isExternal = source === "external";
```

Use these exact source-aware values:

```tsx
<Typography.Paragraph type="secondary">
  {isExternal ? "当前展示外部 CRM 客户池，只读同步客户上下文。" : "当前使用内置客户样例池，真实 CRM 接口就绪后替换数据源。"}
</Typography.Paragraph>

<Typography.Text type="secondary">{isExternal ? "CRM 客户池" : "客户样例池"}</Typography.Text>

<EmptyState
  title={isExternal ? "暂无 CRM 客户" : "暂无客户样例"}
  description={isExternal ? "CRM 当前未返回可用客户。" : "当前使用假数据；真实 CRM API 接好后会自动展示客户池。"}
/>

render: () => <Tag color={isExternal ? "green" : "blue"}>{isExternal ? "CRM 数据" : "样例"}</Tag>
```

Do not change the page layout, grouping drilldowns, or table columns.

- [ ] **Step 5: Run frontend focused tests and typecheck**

```powershell
pnpm --filter pas-frontend exec vitest run src/pages/CustomerManagementPage.test.tsx src/App.test.tsx
pnpm --filter pas-frontend typecheck
```

Expected: focused tests PASS and frontend typecheck exits 0.

- [ ] **Step 6: Commit Task 4**

```powershell
git add -- apps/frontend/src/customer-api.ts apps/frontend/src/pages/CustomerManagementPage.tsx apps/frontend/src/pages/CustomerManagementPage.test.tsx apps/frontend/src/pages/WorkbenchPage.tsx
git commit -m "feat: show external CRM customer source"
```

---

### Task 5: Deployment Configuration

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: deployment-provided `CRM_API_TOKEN`.
- Produces: backend container environment for all four CRM settings.

- [ ] **Step 1: Add expected Compose assertions before editing Compose**

Run the existing check once to establish the current output, then inspect the
rendered backend environment:

```powershell
pnpm compose:config
docker compose config | Select-String -Pattern 'CRM_CLIENT_MODE|CRM_BASE_URL|CRM_API_TOKEN|CRM_TIMEOUT_MS'
```

Expected before implementation: `pnpm compose:config` passes, but the rendered
backend environment does not contain the four CRM settings.

- [ ] **Step 2: Document the CRM environment contract**

Add directly below `CRM_CLIENT_MODE=mock` in `.env.example`:

```dotenv
# External mode is read-only and accepts only https://demo.sworditsys.com/api/v1.
CRM_BASE_URL=https://demo.sworditsys.com/api/v1
CRM_API_TOKEN=
CRM_TIMEOUT_MS=10000
```

- [ ] **Step 3: Forward CRM settings to the backend container**

Add to `pas-backend.environment` in `docker-compose.yml`:

```yaml
CRM_CLIENT_MODE: ${CRM_CLIENT_MODE:-mock}
CRM_BASE_URL: ${CRM_BASE_URL:-https://demo.sworditsys.com/api/v1}
CRM_API_TOKEN: ${CRM_API_TOKEN:-}
CRM_TIMEOUT_MS: ${CRM_TIMEOUT_MS:-10000}
```

Do not add these values to the frontend service.

- [ ] **Step 4: Validate Compose and secret placement**

```powershell
pnpm compose:config
docker compose config | Select-String -Pattern 'CRM_CLIENT_MODE|CRM_BASE_URL|CRM_TIMEOUT_MS'
Select-String -Path 'docker-compose.yml','.env.example' -Pattern 'pem_[A-Za-z0-9]+'
```

Expected: Compose validation passes, the three non-secret settings are present,
and the secret-pattern search returns no matches.

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- .env.example docker-compose.yml
git commit -m "chore: configure external CRM deployment"
```

---

### Task 6: Full Verification And Live Read-Only Acceptance

**Files:**
- Verify only; do not add the operator-provided token or generated artifacts to Git.

**Interfaces:**
- Consumes: the already operator-provided, short-lived CRM token from an ignored
  local `.env` or current process environment.
- Produces: test, build, Compose, local runtime, browser, and Git evidence.

- [ ] **Step 1: Run all automated repository gates**

```powershell
pnpm --filter pas-backend test
pnpm --filter pas-frontend test
pnpm typecheck
pnpm build
pnpm compose:config
pnpm test:smoke
```

Expected: every command exits 0. Record exact test counts in the completion
report.

- [ ] **Step 2: Verify no secret entered tracked content**

```powershell
git grep -n -E 'pem_[A-Za-z0-9]+' -- . ':(exclude).env'
git status --short
```

Expected: the token search returns no match and the worktree contains no
uncommitted tracked changes.

- [ ] **Step 3: Start the backend in external mode**

Use the already supplied token only in the current process or ignored root
`.env`. Set these non-secret values exactly:

```powershell
$env:CRM_CLIENT_MODE = 'external'
$env:CRM_BASE_URL = 'https://demo.sworditsys.com/api/v1'
$env:CRM_TIMEOUT_MS = '10000'
docker compose up -d --build pas-backend pas-frontend
docker compose ps
```

Expected: `pas-backend` and `pas-frontend` become healthy. Never print
`CRM_API_TOKEN` or run `docker compose config` after injecting the live token,
because rendered Compose output can include environment values.

- [ ] **Step 4: Verify the customer page in the in-app browser**

Open `http://127.0.0.1:18000/customers` using the browser skill and verify:

- the page loads at least one CRM customer;
- the copy contains `CRM 客户池` and row status `CRM 数据`;
- no `样例` status or built-in sample explanation remains;
- industry and region drilldowns still work at desktop and mobile widths;
- no customer field overlaps or overflows.

Capture one desktop screenshot and one mobile screenshot as verification
artifacts outside tracked source files.

- [ ] **Step 5: Verify downstream customer context**

In the browser, open customer insights, select one real CRM customer, and run
customer analysis. Then open proposal tasks, select the same customer, and
start one proposal generation flow. Verify both requests move past customer
lookup and do not fail with `Customer not found`, mock-customer identifiers, or
CRM mapping errors. Existing RAGFlow/LLM failures, if any, must be reported
separately and must not be misclassified as CRM failures.

- [ ] **Step 6: Reconfirm the read-only guarantee**

Run the focused request-ledger test after the live workflow:

```powershell
pnpm --filter pas-backend exec vitest run src/crm/external-crm.client.integration.spec.ts src/crm/external-crm.client.spec.ts
```

Expected: PASS, including the assertion that every observed transport request
method is `GET` and no request body is sent.

- [ ] **Step 7: Leave the trial environment on external read-only CRM**

Keep `CRM_CLIENT_MODE=external`, restart `pas-backend` after any environment
change, and confirm both containers remain healthy. Do not restore mock mode
unless the external CRM is unavailable and the user explicitly changes the
trial requirement. This configuration choice never modifies CRM data.

- [ ] **Step 8: Final Git verification and push**

```powershell
git status --short --branch
git log -6 --oneline
git push
```

Expected: clean branch, the five implementation commits visible, and the remote
branch updated.
