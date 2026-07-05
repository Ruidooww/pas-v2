import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("shows the login page when no token is stored", async () => {
    localStorage.clear();
    render(<App />);

    expect(await screen.findByRole("heading", { name: /PAS/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /登\s*录/ })).toBeTruthy();
  });

  it("shows the V2 business flow console for an authenticated user", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/me") {
          return jsonResponse({
            userId: "admin-1",
            username: "admin@example.com",
            displayName: "Admin",
            role: "admin",
            active: true
          });
        }
        if (path === "/api/crm/customers") {
          return jsonResponse({ customers: [] });
        }
        if (path === "/api/internal/business-flows/records") {
          return jsonResponse({ records: [] });
        }
        if (path === "/api/internal/business-flows/metrics") {
          return jsonResponse({ definitions: [], counters: [] });
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    const menuItem = await screen.findByText("V2 业务闭环");
    fireEvent.click(menuItem);

    expect(await screen.findByRole("heading", { name: "V2 业务闭环" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "商机" })).toBeTruthy();
  });

  it("shows the V3 platform console for an authenticated user", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/me") {
          return jsonResponse({
            userId: "admin-1",
            username: "admin@example.com",
            displayName: "Admin",
            role: "admin",
            active: true
          });
        }
        if (path === "/api/internal/platform/overview") {
          return jsonResponse(createPlatformOverview());
        }
        if (path === "/api/crm/customers") {
          return jsonResponse({ customers: [] });
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    const menuItem = await screen.findByText("V3 平台化");
    fireEvent.click(menuItem);

    expect(await screen.findByRole("heading", { name: "V3 平台化" })).toBeTruthy();
    expect(screen.getByText("经营驾驶舱")).toBeTruthy();
    expect(screen.getByText("多渠道入口")).toBeTruthy();
    expect(screen.getByText("Agent / Skill 编排")).toBeTruthy();
  });
});

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function createPlatformOverview() {
  return {
    dashboard: {
      filters: {},
      cards: [
        { key: "sales_funnel", title: "销售漏斗", value: 2, unit: "条" },
        { key: "pending_inputs", title: "待外部输入", value: 1, unit: "项" }
      ],
      drilldowns: {
        salesFunnel: [{ stage: "proposal", count: 1 }],
        channelContribution: [{ channel: "华东金牌渠道", count: 1 }],
        productMix: [{ product: "IP-Guard", count: 1 }],
        knowledgeUsage: [{ metric: "knowledge.records_created", value: 3 }],
        proposalConversion: [{ metric: "proposal_jobs_from_meetings", value: 1 }]
      },
      methodology: [{ key: "sales_funnel", description: "Count opportunities" }]
    },
    channels: [
      {
        channelId: "web",
        kind: "web",
        name: "PAS Web",
        status: "active",
        identityMapping: "pas_user",
        pendingInputs: []
      }
    ],
    recentSessions: [],
    agents: [{ agentId: "agent-1", name: "售前编排 Agent", status: "active", purpose: "编排", allowedScopes: [], ownerRole: "presales" }],
    skills: [{ skillId: "skill-1", name: "知识库检索", status: "approved", requestedScopes: [], scan: { riskLevel: "low", findings: [] } }],
    workflows: [{ workflowId: "workflow-1", name: "客户信号触达工作流", status: "active", trigger: "cip", complexity: "controlled", agentIds: [], skillIds: [] }],
    products: [{ productId: "ip-guard", name: "IP-Guard", status: "enabled", version: "v4", ownerTeam: "产品线", pendingInputs: [] }],
    cipSignals: [],
    tenant: {
      tenantId: "internal-hyyn",
      organizationId: "hyyn",
      mode: "single_org",
      isolationFields: ["tenantId"],
      billingReserved: true,
      singleOrgCompatible: true
    },
    security: {
      totalEvents: 1,
      eventsByType: { agent_execution: 1 },
      sensitiveAlerts: [],
      permissionBoundaryChecks: [{ key: "agent_skill_approval", status: "passed", summary: "ok" }]
    },
    trialReadiness: [{ area: "Agent/Skill", status: "code_ready", note: "ready" }],
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}
