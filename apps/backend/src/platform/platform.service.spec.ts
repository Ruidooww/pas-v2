import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { BusinessFlowService } from "../business-flow/business-flow.service";
import { PlatformService } from "./platform.service";
import { PlatformStoreService } from "./platform-store.service";

const adminActor: AuthenticatedUser = {
  userId: "admin-1",
  username: "admin@example.com",
  displayName: "Admin",
  role: "admin"
};

const salesActor: AuthenticatedUser = {
  userId: "sales-1",
  username: "sales@example.com",
  displayName: "Sales",
  role: "sales"
};

describe("PlatformService", () => {
  it("builds an executive dashboard from V2 records and V3 platform state", () => {
    const service = createService();

    const dashboard = service.getDashboard({}, adminActor);

    expect(dashboard.filters).toEqual({});
    expect(dashboard.cards.find((card) => card.key === "sales_funnel")?.value).toBe(2);
    expect(dashboard.cards.find((card) => card.key === "pending_inputs")?.value).toBe(1);
    expect(dashboard.methodology).toContainEqual(expect.objectContaining({ key: "sales_funnel" }));
    expect(dashboard.drilldowns.salesFunnel[0]).toMatchObject({ stage: "proposal", count: 1 });
  });

  it("applies dashboard filters to the records and platform state being counted", () => {
    const service = createService();

    const dashboard = service.getDashboard({ product: "IP-Guard", channel: "华东金牌渠道" }, adminActor);

    expect(dashboard.filters).toMatchObject({ product: "IP-Guard", channel: "华东金牌渠道" });
    expect(dashboard.cards.find((card) => card.key === "sales_funnel")?.value).toBe(1);
    expect(dashboard.cards.find((card) => card.key === "pending_inputs")?.value).toBe(0);
    expect(dashboard.cards.find((card) => card.key === "channel_contribution")?.value).toBe(1);
  });

  it("routes multi-channel messages and records task notifications", () => {
    const service = createService();

    const result = service.routeMessage(
      {
        channel: "feishu",
        externalUserId: "ou_1",
        text: "请基于华信精工资料生成方案",
        sourceRef: "feishu-message-1"
      },
      salesActor
    );

    expect(result.session.channel).toBe("feishu");
    expect(result.session.identity.userId).toBe("sales-1");
    expect(result.session.actions[0]).toMatchObject({
      type: "create_deliverable_task",
      status: "pending_external_adapter"
    });
    expect(result.notification.targetChannel).toBe("feishu");
    expect(result.auditEvent.type).toBe("channel_message");
  });

  it("imports, scans, approves, and runs Skill-backed workflows with execution audit", () => {
    const service = createService();

    const skill = service.importSkill(
      {
        name: "Proposal Brief Builder",
        description: "整理客户需求并生成方案提纲",
        requestedScopes: ["proposal:write", "knowledge:read"],
        packageManifest: "name: proposal-brief-builder"
      },
      adminActor
    );

    expect(skill.status).toBe("pending_approval");
    expect(skill.scan.riskLevel).toBe("low");

    const approved = service.approveSkill(skill.skillId, adminActor);
    expect(approved.status).toBe("approved");

    const execution = service.runWorkflow(
      {
        workflowId: "customer_followup_workflow",
        input: {
          customerId: "demo-huaxin-manufacturing",
          trigger: "purchase-window"
        }
      },
      adminActor
    );

    expect(execution.status).toBe("completed");
    expect(execution.steps.map((step) => step.status)).toEqual(["completed", "completed"]);
    expect(service.getSecurityReport(adminActor).eventsByType.agent_execution).toBeGreaterThan(0);
  });

  it("rejects non-admin platform registry and sales workflow mutations", () => {
    const service = createService();

    expect(() =>
      service.importSkill(
        {
          name: "Proposal Brief Builder",
          description: "整理客户需求并生成方案提纲",
          requestedScopes: ["proposal:write"],
          packageManifest: "name: proposal-brief-builder"
        },
        salesActor
      )
    ).toThrow(ForbiddenException);
    expect(() =>
      service.registerProduct(
        {
          name: "Partner DLP Suite",
          version: "1.0",
          ownerTeam: "渠道事业部"
        },
        salesActor
      )
    ).toThrow(ForbiddenException);
    expect(() =>
      service.runWorkflow(
        {
          workflowId: "customer_followup_workflow",
          input: {
            customerId: "demo-huaxin-manufacturing"
          }
        },
        salesActor
      )
    ).toThrow(ForbiddenException);
    expect(() =>
      service.detectCipSignals(
        {
          customerId: "demo-huaxin-manufacturing",
          customerName: "华信精工",
          evidenceText: "90天未拜访"
        },
        salesActor
      )
    ).toThrow(ForbiddenException);
  });

  it("registers partner products with template, API, webhook, and plugin declarations", () => {
    const service = createService();

    const product = service.registerProduct(
      {
        name: "Partner DLP Suite",
        version: "1.0",
        ownerTeam: "渠道事业部",
        knowledgePartitionIds: ["partner-dlp"],
        proposalTemplateIds: ["proposal-partner-dlp-v1"],
        exportTemplateIds: ["docx-partner-dlp-v1", "pptx-partner-dlp-v1"],
        webhookEvents: ["product.enabled", "proposal.generated"],
        apiVersion: "v3",
        pluginDependencies: ["proposal-brief-builder"]
      },
      adminActor
    );

    expect(product.status).toBe("enabled");
    expect(product.webhookEvents).toContain("proposal.generated");
    expect(product.pluginDependencies).toContain("proposal-brief-builder");
  });

  it("detects five CIP signal categories and preserves single-organization compatibility", () => {
    const service = createService();

    const signals = service.detectCipSignals(
      {
        customerId: "demo-huaxin-manufacturing",
        customerName: "华信精工",
        evidenceText: "90天未拜访，竞品进入测试，信息化负责人离职，9月采购窗口，发生终端泄密事件，维保即将到期"
      },
      adminActor
    );

    expect(signals.map((signal) => signal.type)).toEqual(
      expect.arrayContaining([
        "silent_customer",
        "competitor_involved",
        "personnel_change",
        "purchase_window",
        "security_incident",
        "renewal_expansion"
      ])
    );
    expect(service.getTenantReservation(adminActor)).toMatchObject({
      mode: "single_org",
      singleOrgCompatible: true,
      billingReserved: true
    });
  });
});

function createService(): PlatformService {
  const businessFlowService = {
    listRecords: vi.fn(() => [
      {
        recordId: "bf-1",
        kind: "opportunity",
        status: "confirmed",
        ownerUserId: "sales-1",
        ownerRole: "sales",
        source: { system: "manual_text", reference: "note-1", capturedAt: "2026-07-05T00:00:00.000Z" },
        payload: {},
        outputs: {
          opportunity: {
            customerName: "华信精工",
            demand: "IP-Guard 防泄漏",
            stage: "proposal",
            sourceSummary: "manual"
          }
        },
        pendingInputs: [],
        events: [],
        createdAt: "2026-07-05T00:00:00.000Z",
        updatedAt: "2026-07-05T00:00:00.000Z"
      },
      {
        recordId: "bf-2",
        kind: "opportunity",
        status: "sync_pending",
        ownerUserId: "sales-1",
        ownerRole: "sales",
        source: { system: "crm", reference: "crm-1", capturedAt: "2026-07-05T00:00:00.000Z" },
        payload: {},
        outputs: {
          opportunity: {
            customerName: "中科样例",
            demand: "终端管控",
            stage: "negotiation",
            sourceSummary: "crm"
          }
        },
        pendingInputs: ["external_crm"],
        events: [],
        createdAt: "2026-07-05T00:00:00.000Z",
        updatedAt: "2026-07-05T00:00:00.000Z"
      },
      {
        recordId: "bf-3",
        kind: "channel",
        status: "completed",
        ownerUserId: "sales-1",
        ownerRole: "sales",
        source: { system: "channel_ro", reference: "channel-1", capturedAt: "2026-07-05T00:00:00.000Z" },
        payload: {},
        outputs: {
          channelContext: {
            partnerName: "华东金牌渠道",
            partnerLevel: "gold",
            authorizedRegions: ["华东"],
            customerName: "华信精工",
            pricePolicy: "standard",
            registrationStatus: "registered_by_this_partner",
            duplicateRisk: false,
            proposalVariables: {
              partnerName: "华东金牌渠道",
              partnerLevel: "gold",
              authorizedRegions: "华东",
              pricePolicy: "standard"
            }
          }
        },
        pendingInputs: [],
        events: [],
        createdAt: "2026-07-05T00:00:00.000Z",
        updatedAt: "2026-07-05T00:00:00.000Z"
      }
    ]),
    getMetrics: vi.fn(() => ({
      definitions: [],
      counters: [
        { name: "opportunity.records_created", value: 2 },
        { name: "channel.records_created", value: 1 }
      ]
    }))
  } as unknown as BusinessFlowService;

  return new PlatformService(new PlatformStoreService(), businessFlowService);
}
