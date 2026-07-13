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

  it("accepts only finite numeric opportunity amounts", async () => {
    const opportunities = await loadMappedOpportunities([
      { estimatedAmount: 125.5 },
      { estimatedAmount: " 380000.50 " },
      { estimatedAmount: true },
      { estimatedAmount: null },
      { estimatedAmount: "   " },
      { estimatedAmount: "12x" },
      { estimatedAmount: Number.POSITIVE_INFINITY }
    ]);

    expect(opportunities.map(({ estimatedValue }) => estimatedValue)).toEqual([
      125.5,
      380000.5,
      0,
      0,
      0,
      0,
      0
    ]);
  });

  it("accepts only exact dates or complete valid ISO opportunity datetimes", async () => {
    const opportunities = await loadMappedOpportunities([
      { estimatedCloseAt: "2024-02-29T00:00:00.000Z" },
      { estimatedCloseAt: "2026-12-31" },
      { estimatedCloseAt: "2026-06-15T23:59:59+08:00" },
      { estimatedCloseAt: "2023-02-29T00:00:00.000Z" },
      { estimatedCloseAt: "2026-04-31" },
      { estimatedCloseAt: "2026-13-01" },
      { estimatedCloseAt: "2026-2-03" },
      { estimatedCloseAt: "2026-12-31garbage" },
      { estimatedCloseAt: "2026-12-31T25:00:00.000Z" },
      { estimatedCloseAt: "2026-12-31T12:00" }
    ]);

    expect(opportunities.map(({ expectedCloseDate }) => expectedCloseDate)).toEqual([
      "2024-02-29",
      "2026-12-31",
      "2026-06-15",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]);
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

  it("returns undefined when the requested customer does not exist", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, { secret: "must-not-leak" }));

    await expect(new ExternalCrmClient(config, fetcher).getCustomerContext("customer-1")).resolves.toBeUndefined();
  });

  it.each([
    ["customer list", "list", "/customers?page=1&pageSize=100"],
    ["owners", "context", "/users/options"],
    ["contacts", "context", "/customers/customer-1/contacts"],
    ["followups", "context", "/customers/customer-1/followups?page=1&pageSize=100"],
    ["opportunities", "context", "/opportunities?customerId=customer-1&page=1&pageSize=100"]
  ] as const)("maps a non-detail %s HTTP 404 to CRM_REQUEST_REJECTED", async (_, operation, rejectedPath) => {
    const fetcher = vi.fn(async (url: string) => {
      const path = url.slice(config.baseUrl.length);
      if (path === rejectedPath) return jsonResponse(404, { secret: "must-not-leak" });
      if (path === "/customers/customer-1") {
        return jsonResponse(200, { data: { id: "customer-1", name: "Acme" } });
      }
      if (path === "/users/options" || path === "/customers/customer-1/contacts") {
        return jsonResponse(200, { data: [] });
      }
      return jsonResponse(200, { data: [], meta: { totalPages: 1 } });
    });
    const client = new ExternalCrmClient(config, fetcher);
    const promise =
      operation === "list" ? client.listCustomers() : client.getCustomerContext("customer-1");

    await expect(promise).rejects.toMatchObject({
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

  it.each([
    ["missing meta", undefined],
    ["missing totalPages", {}],
    ["non-number totalPages", { totalPages: "1" }],
    ["non-integer totalPages", { totalPages: 1.5 }],
    ["totalPages below one", { totalPages: 0 }],
    ["totalPages above the bounded maximum", { totalPages: 101 }]
  ] as const)("rejects pagination with %s", async (_, meta) => {
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith("/users/options")
        ? jsonResponse(200, { data: [] })
        : jsonResponse(200, meta === undefined ? { data: [] } : { data: [], meta })
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

async function loadMappedOpportunities(values: Record<string, unknown>[]) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/customers/customer-1")) {
      return jsonResponse(200, { data: { id: "customer-1", name: "Acme" } });
    }
    if (url.endsWith("/users/options") || url.endsWith("/customers/customer-1/contacts")) {
      return jsonResponse(200, { data: [] });
    }
    if (url.includes("/customers/customer-1/followups")) {
      return jsonResponse(200, { data: [], meta: { totalPages: 1 } });
    }
    return jsonResponse(200, {
      data: values.map((value, index) => ({
        id: `opportunity-${index}`,
        name: `Opportunity ${index}`,
        stage: "POC_TEST",
        ...value
      })),
      meta: { totalPages: 1 }
    });
  });

  const context = await new ExternalCrmClient(config, fetcher).getCustomerContext("customer-1");
  if (!context) throw new Error("Expected customer context");
  return context.opportunities;
}
