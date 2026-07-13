import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformPage } from "./PlatformPage";
import type { PlatformOverview, PublicUser } from "../types";

const adminUser: PublicUser = {
  userId: "admin-1",
  username: "admin",
  displayName: "Admin",
  role: "admin",
  organizationUnitId: "org-company",
  projectGroupIds: [],
  active: true
};

describe("PlatformPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/platform");
  });

  it("shows an error when the initial platform overview request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: "platform overview unavailable" })
        } as Response)
      )
    );

    render(<PlatformPage user={adminUser} mode="governance" />);

    expect(await screen.findByText("服务暂时不可用，请稍后再试")).toBeTruthy();
    expect(screen.queryByText("platform overview unavailable")).toBeNull();
  });

  it("expands the sales funnel breakdown from an analytics metric", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(createPlatformOverview())));

    render(<PlatformPage user={adminUser} mode="analytics" />);
    fireEvent.click(await screen.findByRole("button", { name: "查看销售漏斗明细" }));

    expect(await screen.findByRole("heading", { name: "销售漏斗明细" })).toBeTruthy();
    expect(screen.getByText("proposal：1")).toBeTruthy();
    expect(window.location.search).toBe("?metric=sales_funnel");
  });

  it("shows only approved skills after drilling from the governance metric", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(createPlatformOverview())));

    render(<PlatformPage user={adminUser} mode="governance" />);
    fireEvent.click(await screen.findByRole("button", { name: "查看已批准 Skill明细" }));

    expect(await screen.findByText("知识库检索")).toBeTruthy();
    expect(screen.queryByText("待审批 Skill")).toBeNull();
    expect(window.location.search).toBe("?platform=approved_skills");
  });
});

function createPlatformOverview(): PlatformOverview {
  return {
    dashboard: {
      filters: {},
      cards: [
        { key: "sales_funnel", title: "销售漏斗", value: 2, unit: "条" },
        { key: "pending_inputs", title: "待外部输入", value: 1, unit: "项" }
      ],
      drilldowns: {
        salesFunnel: [{ stage: "proposal", count: 1 }],
        channelContribution: [{ channel: "华东渠道", count: 1 }],
        productMix: [{ product: "IP-Guard", count: 1 }],
        knowledgeUsage: [],
        proposalConversion: []
      },
      methodology: [{ key: "pending_inputs", description: "Count pending inputs" }]
    },
    channels: [
      { channelId: "web", kind: "web", name: "PAS Web", status: "active", identityMapping: "pas_user", pendingInputs: [] },
      { channelId: "feishu", kind: "feishu", name: "Feishu", status: "adapter_pending", identityMapping: "pending", pendingInputs: ["adapter"] }
    ],
    recentSessions: [],
    agents: [],
    skills: [
      { skillId: "skill-1", name: "知识库检索", status: "approved", requestedScopes: [], scan: { riskLevel: "low", findings: [] } },
      { skillId: "skill-2", name: "待审批 Skill", status: "pending_approval", requestedScopes: [], scan: { riskLevel: "low", findings: [] } }
    ],
    workflows: [],
    products: [
      { productId: "product-1", name: "IP-Guard", version: "v4", ownerTeam: "产品线", status: "enabled", knowledgePartitionIds: [], proposalTemplateIds: [], exportTemplateIds: [], webhookEvents: [], apiVersion: "v3", pluginDependencies: [], pendingInputs: [] }
    ],
    cipSignals: [],
    tenant: { tenantId: "internal", organizationId: "hyyn", mode: "single_org", isolationFields: ["tenantId"], billingReserved: true, singleOrgCompatible: true },
    security: { totalEvents: 1, eventsByType: {}, sensitiveAlerts: [], permissionBoundaryChecks: [] },
    trialReadiness: [],
    updatedAt: "2026-07-13T00:00:00.000Z"
  };
}

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response;
}
