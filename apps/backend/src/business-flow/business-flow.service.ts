import type { AuthenticatedUser } from "../auth/auth.types";
import type { CrmClient, CrmCustomerContext } from "../crm/crm.types";
import type { ProposalService } from "../proposal/proposal.service";
import type { ProposalGenerationRequest, ProposalJob } from "../proposal/proposal.types";
import { BusinessFlowStoreService, canReadRecord } from "./business-flow-store.service";
import type {
  AfterSalesAnswer,
  BusinessFlowActor,
  BusinessFlowEventType,
  BusinessFlowKind,
  BusinessFlowRecord,
  BusinessMetrics,
  ChannelContext,
  ContractReview,
  ContractRisk,
  CustomerSignal,
  MaintenanceReminder,
  MeetingMinutes,
  OpportunityStage,
  StructuredOpportunity
} from "./business-flow.types";

type ProposalGenerator = Pick<ProposalService, "generate">;

export type ExtractOpportunityRequest = {
  text: string;
  sourceRef: string;
};

export type ConfirmOpportunityRequest = {
  opportunity: StructuredOpportunity;
};

export type SummarizeMeetingRequest = {
  customerId: string;
  transcript: string;
  sourceRef: string;
};

export type ReviewContractRequest = {
  customerId: string;
  contractTitle: string;
  contractText: string;
  sourceRef: string;
};

export type AnswerAfterSalesRequest = {
  customerId: string;
  question: string;
  sourceRef: string;
};

export type MaintenanceReminderRequest = {
  customerId: string;
  productName: string;
  contractEndDate: string;
  sourceRef: string;
};

export type ChannelContextRequest = {
  partnerName: string;
  partnerLevel: string;
  authorizedRegions: string[];
  customerName: string;
  pricePolicy: string;
  registrationStatus: string;
  sourceRef: string;
};

export type CustomerSignalRequest = {
  customerId: string;
  manualSignals?: string[];
  sourceRef: string;
};

export class BusinessFlowService {
  constructor(
    private readonly crmClient: CrmClient,
    private readonly store: BusinessFlowStoreService,
    private readonly proposalService: ProposalGenerator
  ) {}

  async extractOpportunity(request: ExtractOpportunityRequest, actor: AuthenticatedUser): Promise<BusinessFlowRecord> {
    const now = nowIso();
    const opportunity = parseOpportunity(request.text);
    const record = createRecord({
      kind: "opportunity",
      actor,
      sourceSystem: "manual_text",
      sourceRef: request.sourceRef,
      title: opportunity.customerName,
      payload: { text: request.text, title: opportunity.customerName },
      outputs: { opportunity },
      pendingInputs: ["crm_writeback_adapter"],
      events: ["record_created", "opportunity_extracted"],
      now,
      status: "pending_confirmation"
    });
    return this.store.create(record);
  }

  confirmOpportunity(
    recordId: string,
    request: ConfirmOpportunityRequest,
    actor: AuthenticatedUser
  ): BusinessFlowRecord {
    const record = this.getAccessibleRecord(recordId, actor);
    if (record.kind !== "opportunity") {
      throw new Error("Record is not an opportunity");
    }
    const now = nowIso();
    return this.store.update({
      ...record,
      status: "confirmed",
      outputs: {
        ...record.outputs,
        opportunity: request.opportunity
      },
      events: [...record.events, createEvent("opportunity_confirmed", actor.userId, now)],
      updatedAt: now
    });
  }

  requestOpportunitySync(recordId: string, actor: AuthenticatedUser): BusinessFlowRecord {
    const record = this.getAccessibleRecord(recordId, actor);
    if (record.kind !== "opportunity") {
      throw new Error("Record is not an opportunity");
    }
    if (record.status !== "confirmed") {
      throw new Error("Opportunity must be confirmed before sync");
    }
    const now = nowIso();
    return this.store.update({
      ...record,
      status: "sync_pending",
      outputs: {
        ...record.outputs,
        syncRequest: {
          targetSystem: "external_crm",
          status: "pending_external_adapter",
          humanConfirmed: true,
          requestedAt: now
        }
      },
      events: [...record.events, createEvent("pending_external_sync", actor.userId, now)],
      updatedAt: now
    });
  }

  async summarizeMeeting(request: SummarizeMeetingRequest, actor: AuthenticatedUser): Promise<BusinessFlowRecord> {
    const customer = await this.requireCustomer(request.customerId);
    const minutes = buildMeetingMinutes(customer.customerId, request.transcript);
    const now = nowIso();
    return this.store.create(
      createRecord({
        kind: "meeting",
        actor,
        sourceSystem: "meeting_transcript",
        sourceRef: request.sourceRef,
        title: `${customer.name} meeting`,
        payload: {
          customerId: customer.customerId,
          transcript: request.transcript,
          title: `${customer.name} meeting`
        },
        outputs: { meetingMinutes: minutes },
        pendingInputs: ["asr_service"],
        events: ["record_created", "meeting_summarized"],
        now,
        status: "completed"
      })
    );
  }

  async createMeetingProposal(
    recordId: string,
    actor: AuthenticatedUser
  ): Promise<{ record: BusinessFlowRecord; proposalJob: ProposalJob }> {
    const record = this.getAccessibleRecord(recordId, actor);
    if (record.kind !== "meeting" || !record.outputs.meetingMinutes) {
      throw new Error("Meeting minutes are required before proposal generation");
    }
    const request: ProposalGenerationRequest = {
      customerId: record.outputs.meetingMinutes.customerId,
      userId: actor.userId,
      user: actor,
      humanInputs: record.outputs.meetingMinutes.requirements.map((requirement, index) => ({
        inputId: `meeting-requirement-${index + 1}`,
        label: "Meeting requirement",
        value: requirement
      }))
    };
    const proposalJob = await this.proposalService.generate(request);
    const now = nowIso();
    const updated = this.store.update({
      ...record,
      outputs: {
        ...record.outputs,
        proposalJobId: proposalJob.jobId,
        proposalJob
      },
      events: [...record.events, createEvent("meeting_proposal_started", actor.userId, now)],
      updatedAt: now
    });
    return { record: updated, proposalJob };
  }

  reviewContract(request: ReviewContractRequest, actor: AuthenticatedUser): BusinessFlowRecord {
    const review = buildContractReview(request);
    const now = nowIso();
    return this.store.create(
      createRecord({
        kind: "contract_review",
        actor,
        sourceSystem: "contract_file",
        sourceRef: request.sourceRef,
        title: request.contractTitle,
        payload: {
          customerId: request.customerId,
          contractTitle: request.contractTitle,
          contractText: request.contractText,
          title: request.contractTitle
        },
        outputs: { contractReview: review },
        pendingInputs: ["contract_rulebook", "external_contract_system"],
        events: ["record_created", "contract_reviewed"],
        now,
        status: "pending_confirmation"
      })
    );
  }

  confirmContractReview(recordId: string, actor: AuthenticatedUser): BusinessFlowRecord {
    const record = this.getAccessibleRecord(recordId, actor);
    if (record.kind !== "contract_review") {
      throw new Error("Record is not a contract review");
    }
    const now = nowIso();
    return this.store.update({
      ...record,
      status: "confirmed",
      events: [...record.events, createEvent("contract_review_confirmed", actor.userId, now)],
      updatedAt: now
    });
  }

  answerAfterSales(request: AnswerAfterSalesRequest, actor: AuthenticatedUser): BusinessFlowRecord {
    const answer = buildAfterSalesAnswer(request);
    const now = nowIso();
    return this.store.create(
      createRecord({
        kind: "after_sales",
        actor,
        sourceSystem: "after_sales",
        sourceRef: request.sourceRef,
        title: request.question,
        payload: { customerId: request.customerId, question: request.question, title: request.question },
        outputs: { afterSalesAnswer: answer },
        pendingInputs: ["after_sales_knowledge_base"],
        events: ["record_created", "after_sales_answered"],
        now,
        status: "completed"
      })
    );
  }

  createMaintenanceReminders(request: MaintenanceReminderRequest, actor: AuthenticatedUser): BusinessFlowRecord {
    const reminders: MaintenanceReminder[] = [90, 60, 30].map((days) => ({
      customerId: request.customerId,
      productName: request.productName,
      daysBeforeExpiry: days as 90 | 60 | 30,
      remindAt: subtractDays(request.contractEndDate, days),
      contractEndDate: request.contractEndDate
    }));
    const now = nowIso();
    return this.store.create(
      createRecord({
        kind: "after_sales",
        actor,
        sourceSystem: "maintenance",
        sourceRef: request.sourceRef,
        title: `${request.productName} maintenance`,
        payload: { ...request, title: `${request.productName} maintenance` },
        outputs: { maintenanceReminders: reminders },
        pendingInputs: ["maintenance_contract_source"],
        events: ["record_created", "maintenance_reminders_created"],
        now,
        status: "completed"
      })
    );
  }

  buildChannelContext(request: ChannelContextRequest, actor: AuthenticatedUser): BusinessFlowRecord {
    const context: ChannelContext = {
      partnerName: request.partnerName,
      partnerLevel: request.partnerLevel,
      authorizedRegions: request.authorizedRegions,
      customerName: request.customerName,
      pricePolicy: request.pricePolicy,
      registrationStatus: request.registrationStatus,
      duplicateRisk: request.registrationStatus !== "not_registered" && request.registrationStatus !== "registered_by_this_partner",
      proposalVariables: {
        partnerName: request.partnerName,
        partnerLevel: request.partnerLevel,
        pricePolicy: request.pricePolicy,
        authorizedRegions: request.authorizedRegions.join(", ")
      }
    };
    const now = nowIso();
    return this.store.create(
      createRecord({
        kind: "channel",
        actor,
        sourceSystem: "channel_ro",
        sourceRef: request.sourceRef,
        title: `${request.partnerName}/${request.customerName}`,
        payload: { ...request, title: `${request.partnerName}/${request.customerName}` },
        outputs: { channelContext: context },
        pendingInputs: ["channel_price_source", "channel_registration_source"],
        events: ["record_created", "channel_context_created"],
        now,
        status: "completed"
      })
    );
  }

  async analyzeCustomerSignals(request: CustomerSignalRequest, actor: AuthenticatedUser): Promise<BusinessFlowRecord> {
    const customer = await this.requireCustomer(request.customerId);
    const signals = request.manualSignals ?? [];
    const competitorInvolved = signals.some((signal) => signal.includes("竞品"));
    const purchaseWindow = signals.some((signal) => signal.includes("9月") || signal.includes("采购"))
      ? "near_term"
      : "unknown";
    const output: CustomerSignal = {
      customerId: customer.customerId,
      customerName: customer.name,
      profileDimensions: [customer.industry, customer.region, `${customer.purchasedProducts.length} purchased products`],
      painPoints: customer.followUps.map((followUp) => followUp.summary),
      purchaseWindow,
      competitorInvolved,
      actionSuggestions: [
        competitorInvolved ? "安排可量化试点并准备竞品差异话术" : "补齐业务场景并推进试点范围确认"
      ],
      talkTracks: ["围绕数据外发审计、透明加密和终端管控说明可验证价值"],
      evidenceSources: signals.length > 0 ? ["crm", "manual_signal"] : ["crm"]
    };
    const now = nowIso();
    return this.store.create(
      createRecord({
        kind: "customer_signal",
        actor,
        sourceSystem: "crm",
        sourceRef: request.sourceRef,
        title: customer.name,
        payload: {
          customerId: customer.customerId,
          manualSignals: signals,
          title: customer.name
        },
        outputs: { customerSignal: output },
        pendingInputs: ["activity_stream_adapter"],
        events: ["record_created", "customer_signals_analyzed"],
        now,
        status: "completed"
      })
    );
  }

  listRecords(actor: AuthenticatedUser): BusinessFlowRecord[] {
    return this.store.listForActor(actor);
  }

  getMetrics(actor: BusinessFlowActor): BusinessMetrics {
    const records = actor.role === "admin" ? this.store.list() : this.store.listForActor(actor);
    const counters = metricDefinitions.map((definition) => ({
      name: definition.name,
      value: countMetric(records, definition.module, definition.name)
    }));
    return {
      definitions: metricDefinitions,
      counters
    };
  }

  private async requireCustomer(customerId: string): Promise<CrmCustomerContext> {
    const customer = await this.crmClient.getCustomerContext(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }
    return customer;
  }

  private getAccessibleRecord(recordId: string, actor: AuthenticatedUser): BusinessFlowRecord {
    const record = this.store.get(recordId);
    if (!record) {
      throw new Error("Business flow record not found");
    }
    if (!canReadRecord(record, actor)) {
      throw new Error("Business flow record is not accessible");
    }
    return record;
  }
}

function createRecord(input: {
  kind: BusinessFlowKind;
  actor: AuthenticatedUser;
  sourceSystem: BusinessFlowRecord["source"]["system"];
  sourceRef: string;
  title: string;
  payload: BusinessFlowRecord["payload"];
  outputs: BusinessFlowRecord["outputs"];
  pendingInputs: string[];
  events: BusinessFlowEventType[];
  now: string;
  status: BusinessFlowRecord["status"];
}): BusinessFlowRecord {
  return {
    recordId: createId("bf"),
    kind: input.kind,
    status: input.status,
    ownerUserId: input.actor.userId,
    ownerRole: input.actor.role,
    source: {
      system: input.sourceSystem,
      reference: input.sourceRef,
      capturedAt: input.now
    },
    payload: input.payload,
    outputs: input.outputs,
    pendingInputs: input.pendingInputs,
    events: input.events.map((event) => createEvent(event, input.actor.userId, input.now)),
    createdAt: input.now,
    updatedAt: input.now
  };
}

function parseOpportunity(text: string): StructuredOpportunity {
  const fields = new Map<string, string>();
  for (const part of text.split(/[；;]/)) {
    const [rawKey, ...valueParts] = part.split(/[：:]/);
    const value = valueParts.join(":").trim();
    if (rawKey?.trim() && value) {
      fields.set(rawKey.trim(), value);
    }
  }
  return {
    customerName: fields.get("客户") || "待确认客户",
    demand: fields.get("需求") || text.trim(),
    budgetAmount: parseBudget(fields.get("预算")),
    expectedCloseDate: fields.get("时间"),
    contactName: fields.get("联系人"),
    stage: mapStage(fields.get("阶段")),
    sourceSummary: fields.get("来源") || "manual text"
  };
}

function parseBudget(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const number = Number(match[1]);
  if (Number.isNaN(number)) return undefined;
  return normalized.includes("万") ? number * 10000 : number;
}

function mapStage(value: string | undefined): OpportunityStage {
  if (!value) return "discovery";
  if (value.includes("谈判")) return "negotiation";
  if (value.includes("赢") || value.toLowerCase() === "won") return "won";
  if (value.includes("方案") || value.toLowerCase() === "proposal") return "proposal";
  return "discovery";
}

function buildMeetingMinutes(customerId: string, transcript: string): MeetingMinutes {
  const requirements = extractAfterKeywords(transcript, ["需要", "需求"]);
  const painPoints = extractAfterKeywords(transcript, ["关注", "痛点"]);
  const decisionMakers = extractAfterKeywords(transcript, ["决策人"]);
  const actionItems = extractAfterKeywords(transcript, ["待办"]);
  return {
    customerId,
    summary: transcript.length > 120 ? `${transcript.slice(0, 120)}...` : transcript,
    requirements,
    painPoints,
    decisionMakers,
    actionItems
  };
}

function extractAfterKeywords(text: string, keywords: string[]): string[] {
  for (const keyword of keywords) {
    const index = text.indexOf(keyword);
    if (index < 0) continue;
    const after = text.slice(index + keyword.length).replace(/^[:：]/, "");
    const [value] = after.split(/[。；;]/);
    if (value?.trim()) {
      return [normalizeExtractedItem(value)];
    }
  }
  return [];
}

function normalizeExtractedItem(value: string): string {
  return value.trim().replace(/^(本周|下周|本月|下月)?(给出|完成|提供|输出)/, "");
}

function buildContractReview(request: ReviewContractRequest): ContractReview {
  const risks: ContractRisk[] = [];
  const paymentTermDays = parsePaymentTermDays(request.contractText);
  if (paymentTermDays !== undefined && paymentTermDays > 90) {
    risks.push({
      code: "PAYMENT_TERM_TOO_LONG",
      severity: "medium",
      clause: `付款周期${paymentTermDays}天`,
      suggestion: "建议将付款周期压缩到90天以内或增加阶段性付款。"
    });
  }
  if (request.contractText.includes("无限责任")) {
    risks.push({
      code: "UNLIMITED_LIABILITY",
      severity: "high",
      clause: "乙方承担无限责任",
      suggestion: "建议设置责任上限，并排除间接损失。"
    });
  }
  const acceptanceCriteriaClear = !request.contractText.includes("验收标准以后续邮件为准");
  if (!acceptanceCriteriaClear) {
    risks.push({
      code: "ACCEPTANCE_CRITERIA_UNCLEAR",
      severity: "medium",
      clause: "验收标准以后续邮件为准",
      suggestion: "建议把验收指标、交付物和验收周期写入合同正文。"
    });
  }
  return {
    customerId: request.customerId,
    contractTitle: request.contractTitle,
    keyFields: {
      paymentTermDays,
      hasUnlimitedLiability: request.contractText.includes("无限责任"),
      acceptanceCriteriaClear
    },
    risks,
    reportSummary: risks.length > 0 ? `发现${risks.length}项合同风险，需人工复核。` : "未命中内置风险规则。"
  };
}

function parsePaymentTermDays(text: string): number | undefined {
  const match = text.match(/付款周期.*?(\d+)天/);
  return match ? Number(match[1]) : undefined;
}

function buildAfterSalesAnswer(request: AnswerAfterSalesRequest): AfterSalesAnswer {
  const escalationRequired = ["赔偿", "合同", "崩溃", "紧急"].some((keyword) => request.question.includes(keyword));
  return {
    customerId: request.customerId,
    answer: "先确认客户端在线状态、策略更新时间、最近一次心跳和审计日志，再按产品手册复核策略命中范围。",
    escalationRequired,
    escalationReason: escalationRequired ? "涉及高风险故障或商务责任，需要转人工处理。" : undefined
  };
}

function subtractDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function createEvent(type: BusinessFlowEventType, actorUserId: string, occurredAt: string) {
  return {
    eventId: createId("bfe"),
    type,
    actorUserId,
    occurredAt
  };
}

const metricDefinitions = ([
  "opportunity",
  "meeting",
  "contract_review",
  "after_sales",
  "channel",
  "customer_signal"
] as BusinessFlowKind[]).flatMap((module) => [
  {
    module,
    name: `${module}.records_created`,
    description: "Records created"
  },
  {
    module,
    name: `${module}.records_confirmed`,
    description: "Records confirmed by a human"
  },
  {
    module,
    name: `${module}.pending_external_inputs`,
    description: "Records still waiting for external business inputs"
  }
]);

function countMetric(records: BusinessFlowRecord[], module: BusinessFlowKind, name: string): number {
  const scoped = records.filter((record) => record.kind === module);
  if (name.endsWith(".records_created")) {
    return scoped.length;
  }
  if (name.endsWith(".records_confirmed")) {
    return scoped.filter((record) => record.status === "confirmed" || record.status === "sync_pending").length;
  }
  return scoped.filter((record) => record.pendingInputs.length > 0).length;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}
