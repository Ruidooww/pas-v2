import { describe, expect, it, vi } from "vitest";
import type { CrmConfig } from "./crm.config";
import { ExternalCrmClient } from "./external-crm.client";

const config: CrmConfig = {
  clientMode: "external",
  baseUrl: "https://demo.sworditsys.com/api/v1",
  apiToken: "test-token",
  timeoutMs: 10000
};

describe("ExternalCrmClient", () => {
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

  it("maps a customer-list HTTP 404 to CRM_NOT_FOUND", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, { secret: "must-not-leak" }));

    await expect(new ExternalCrmClient(config, fetcher).listCustomers()).rejects.toMatchObject({
      code: "CRM_NOT_FOUND",
      upstreamStatus: 404
    });
  });

  it("returns undefined when the requested customer does not exist", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, { secret: "must-not-leak" }));

    await expect(new ExternalCrmClient(config, fetcher).getCustomerContext("customer-1")).resolves.toBeUndefined();
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
});

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}
