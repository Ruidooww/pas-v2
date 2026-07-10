import { describe, expect, it, vi } from "vitest";
import type { CrmClient, CrmCustomerContext } from "../crm/crm.types";
import type { ProposalJob } from "../proposal/proposal.types";
import { BusinessFlowService } from "./business-flow.service";
import { BusinessFlowStoreService } from "./business-flow-store.service";

const salesActor = {
  userId: "sales-1",
  username: "sales@example.com",
  displayName: "Sales One",
  role: "sales" as const,
  organizationUnitId: "org-sales",
  projectGroupIds: []
};

const technicalActor = {
  userId: "technical-1",
  username: "technical@example.com",
  displayName: "Technical One",
  role: "technical" as const,
  organizationUnitId: "org-technical-presales",
  projectGroupIds: []
};

describe("BusinessFlowService", () => {
  it("extracts a text opportunity into a human-confirmed workflow", async () => {
    const service = createService();

    const record = await service.extractOpportunity(
      {
        text: "客户：华信精工；需求：终端数据防泄漏；预算：38万；时间：2026-09；联系人：周明；阶段：方案；来源：销售记录",
        sourceRef: "note-1"
      },
      salesActor
    );

    expect(record.kind).toBe("opportunity");
    expect(record.status).toBe("pending_confirmation");
    expect(record.source.system).toBe("manual_text");
    const opportunity = record.outputs.opportunity;
    expect(opportunity).toBeDefined();
    expect(opportunity!.customerName).toBe("华信精工");
    expect(opportunity!.budgetAmount).toBe(380000);
    expect(opportunity!.stage).toBe("proposal");
    expect(record.pendingInputs).toContain("crm_writeback_adapter");
    expect(record.events.map((event) => event.type)).toEqual(["record_created", "opportunity_extracted"]);
  });

  it.each([
    ["1.2亿元", 120000000],
    ["380k", 380000],
    ["38w", 380000],
    ["380000", 380000]
  ])("parses opportunity budget %s", async (budget, expectedAmount) => {
    const service = createService();

    const record = await service.extractOpportunity(
      {
        text: `客户：华信精工；需求：终端数据防泄漏；预算：${budget}；时间：2026-09`,
        sourceRef: "note-1"
      },
      salesActor
    );

    expect(record.outputs.opportunity?.budgetAmount).toBe(expectedAmount);
  });

  it("requires human confirmation before creating a CRM sync request", async () => {
    const service = createService();
    const extracted = await service.extractOpportunity(
      {
        text: "客户：华信精工；需求：终端数据防泄漏；预算：38万；时间：2026-09；联系人：周明",
        sourceRef: "note-1"
      },
      salesActor
    );

    expect(() => service.requestOpportunitySync(extracted.recordId, salesActor)).toThrow(
      "Opportunity must be confirmed before sync"
    );

    const opportunity = extracted.outputs.opportunity;
    expect(opportunity).toBeDefined();
    const confirmed = service.confirmOpportunity(
      extracted.recordId,
      {
        opportunity: {
          ...opportunity!,
          stage: "negotiation"
        }
      },
      salesActor
    );
    const syncRequested = service.requestOpportunitySync(confirmed.recordId, salesActor);

    expect(syncRequested.status).toBe("sync_pending");
    expect(syncRequested.outputs.syncRequest).toMatchObject({
      targetSystem: "external_crm",
      status: "pending_external_adapter",
      humanConfirmed: true
    });
    expect(syncRequested.events.map((event) => event.type)).toContain("pending_external_sync");
  });

  it("summarizes meeting text and starts a proposal with extracted requirements", async () => {
    const proposalJob = createProposalJob();
    const generate = vi.fn().mockResolvedValue(proposalJob);
    const service = createService({ proposalService: { generate } });
    const meeting = await service.summarizeMeeting(
      {
        customerId: "demo-huaxin-manufacturing",
        transcript:
          "客户关注图纸外发审计，需要下周给出透明加密试点方案。决策人周明，待办：售前输出测试计划。",
        sourceRef: "meeting-1"
      },
      technicalActor
    );

    const minutes = meeting.outputs.meetingMinutes;
    expect(minutes).toBeDefined();
    expect(minutes!.summary).toContain("图纸外发审计");
    expect(minutes!.requirements).toContain("透明加密试点方案");
    expect(minutes!.actionItems[0]).toContain("测试计划");

    const result = await service.createMeetingProposal(meeting.recordId, technicalActor);

    expect(result.proposalJob).toBe(proposalJob);
    expect(generate).toHaveBeenCalledWith({
      customerId: "demo-huaxin-manufacturing",
      userId: "technical-1",
      user: technicalActor,
      humanInputs: expect.arrayContaining([
        expect.objectContaining({
          inputId: "meeting-requirement-1",
          value: "透明加密试点方案"
        })
      ])
    });
    expect(result.record.outputs.proposalJobId).toBe("proposal-job-1");
  });

  it("reviews contract text with deterministic risk rules and confirmation", () => {
    const service = createService();

    const record = service.reviewContract(
      {
        customerId: "demo-huaxin-manufacturing",
        contractTitle: "华信精工采购合同",
        contractText: "付款周期为验收后180天。乙方承担无限责任。验收标准以后续邮件为准。",
        sourceRef: "contract-1"
      },
      technicalActor
    );

    const review = record.outputs.contractReview;
    expect(review).toBeDefined();
    expect(review!.risks.map((risk) => risk.code)).toEqual([
      "PAYMENT_TERM_TOO_LONG",
      "UNLIMITED_LIABILITY",
      "ACCEPTANCE_CRITERIA_UNCLEAR"
    ]);
    expect(record.status).toBe("pending_confirmation");

    const confirmed = service.confirmContractReview(record.recordId, technicalActor);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.events.map((event) => event.type)).toContain("contract_review_confirmed");
  });

  it("answers after-sales questions with escalation and creates 90/60/30 maintenance reminders", () => {
    const service = createService();
    const answer = service.answerAfterSales(
      {
        customerId: "demo-huaxin-manufacturing",
        question: "终端离线后策略不生效并且客户要求赔偿，怎么办？",
        sourceRef: "ticket-1"
      },
      technicalActor
    );

    const afterSalesAnswer = answer.outputs.afterSalesAnswer;
    expect(afterSalesAnswer).toBeDefined();
    expect(afterSalesAnswer!.escalationRequired).toBe(true);
    expect(afterSalesAnswer!.escalationReason).toContain("人工");

    const reminders = service.createMaintenanceReminders(
      {
        customerId: "demo-huaxin-manufacturing",
        productName: "IP-Guard",
        contractEndDate: "2026-10-01",
        sourceRef: "contract-1"
      },
      technicalActor
    );

    const maintenanceReminders = reminders.outputs.maintenanceReminders;
    expect(maintenanceReminders).toBeDefined();
    expect(maintenanceReminders!.map((item) => item.daysBeforeExpiry)).toEqual([90, 60, 30]);
    expect(maintenanceReminders![0]?.remindAt).toBe("2026-07-03");
  });

  it("builds channel context with duplicate-registration risk and proposal variables", () => {
    const service = createService();

    const record = service.buildChannelContext(
      {
        partnerName: "华东金牌渠道",
        partnerLevel: "gold",
        authorizedRegions: ["华东"],
        customerName: "华信精工",
        pricePolicy: "standard-discount-85",
        registrationStatus: "registered_by_other_partner",
        sourceRef: "channel-sheet-1"
      },
      salesActor
    );

    const channelContext = record.outputs.channelContext;
    expect(channelContext).toBeDefined();
    expect(channelContext!.duplicateRisk).toBe(true);
    expect(channelContext!.proposalVariables).toMatchObject({
      partnerName: "华东金牌渠道",
      partnerLevel: "gold",
      pricePolicy: "standard-discount-85"
    });
    expect(record.source.system).toBe("channel_ro");
  });

  it("analyzes customer signals with evidence sources and action suggestions", async () => {
    const service = createService();

    const record = await service.analyzeCustomerSignals(
      {
        customerId: "demo-huaxin-manufacturing",
        manualSignals: ["竞品已进入测试", "客户要求9月前完成采购"],
        sourceRef: "signal-1"
      },
      salesActor
    );

    const customerSignal = record.outputs.customerSignal;
    expect(customerSignal).toBeDefined();
    expect(customerSignal!.purchaseWindow).toBe("near_term");
    expect(customerSignal!.competitorInvolved).toBe(true);
    expect(customerSignal!.actionSuggestions[0]).toContain("试点");
    expect(customerSignal!.evidenceSources).toEqual(
      expect.arrayContaining(["crm", "manual_signal"])
    );
  });

  it("returns metric definitions and counters for every V2 module", async () => {
    const service = createService();
    await service.extractOpportunity({ text: "客户：华信精工；需求：防泄漏", sourceRef: "note-1" }, salesActor);
    service.reviewContract(
      {
        customerId: "demo-huaxin-manufacturing",
        contractTitle: "合同",
        contractText: "乙方承担无限责任。",
        sourceRef: "contract-1"
      },
      technicalActor
    );

    const metrics = service.getMetrics({
      userId: "admin-1",
      role: "admin"
    });

    for (const moduleKey of ["opportunity", "meeting", "contract_review", "after_sales", "channel", "customer_signal"]) {
      expect(metrics.definitions.filter((definition) => definition.module === moduleKey)).toHaveLength(3);
    }
    expect(metrics.counters.find((counter) => counter.name === "opportunity.records_created")?.value).toBe(1);
    expect(metrics.counters.find((counter) => counter.name === "contract_review.records_created")?.value).toBe(1);
  });
});

function createService(overrides: { proposalService?: { generate: (request: unknown) => Promise<ProposalJob> } } = {}) {
  const crmClient: CrmClient = {
    listCustomers: vi.fn(),
    getCustomer: vi.fn(async () => createCustomer()),
    getCustomerContext: vi.fn(async () => createCustomer())
  };
  return new BusinessFlowService(
    crmClient,
    new BusinessFlowStoreService(),
    overrides.proposalService ?? { generate: vi.fn() }
  );
}

function createCustomer(): CrmCustomerContext {
  return {
    customerId: "demo-huaxin-manufacturing",
    name: "华信精工",
    industry: "高端制造",
    region: "华东",
    accountOwner: "销售一组",
    contacts: [
      {
        name: "周明",
        title: "信息化负责人",
        role: "decision_maker"
      }
    ],
    opportunities: [
      {
        opportunityId: "opp-1",
        name: "终端数据防泄漏",
        stage: "proposal",
        estimatedValue: 380000,
        expectedCloseDate: "2026-09-30"
      }
    ],
    purchasedProducts: [
      {
        name: "IP-Guard",
        version: "V4",
        activeSeats: 1200
      }
    ],
    followUps: [
      {
        happenedAt: "2026-06-20",
        owner: "销售一组",
        summary: "客户关注研发图纸外发审计、U 盘管控和离职交接场景。"
      }
    ]
  };
}

function createProposalJob(): ProposalJob {
  return {
    jobId: "proposal-job-1",
    status: "completed",
    request: {
      customerId: "demo-huaxin-manufacturing",
      userId: "technical-1"
    },
    progress: [],
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}
