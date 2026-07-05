import type { UserRole } from "../auth/auth.types";
import type { ProposalJob } from "../proposal/proposal.types";

export type BusinessFlowKind =
  | "opportunity"
  | "meeting"
  | "contract_review"
  | "after_sales"
  | "channel"
  | "customer_signal";

export type BusinessFlowStatus = "pending_confirmation" | "confirmed" | "sync_pending" | "completed";

export type BusinessFlowActor = {
  userId: string;
  role: UserRole;
};

export type BusinessFlowSource = {
  system: "manual_text" | "meeting_transcript" | "contract_file" | "after_sales" | "maintenance" | "channel_ro" | "crm";
  reference: string;
  capturedAt: string;
};

export type BusinessFlowEventType =
  | "record_created"
  | "opportunity_extracted"
  | "opportunity_confirmed"
  | "pending_external_sync"
  | "meeting_summarized"
  | "meeting_proposal_started"
  | "contract_reviewed"
  | "contract_review_confirmed"
  | "after_sales_answered"
  | "maintenance_reminders_created"
  | "channel_context_created"
  | "customer_signals_analyzed";

export type BusinessFlowEvent = {
  eventId: string;
  type: BusinessFlowEventType;
  actorUserId: string;
  occurredAt: string;
};

export type OpportunityStage = "discovery" | "proposal" | "negotiation" | "won";

export type StructuredOpportunity = {
  customerName: string;
  demand: string;
  budgetAmount?: number;
  expectedCloseDate?: string;
  contactName?: string;
  stage: OpportunityStage;
  sourceSummary: string;
};

export type ExternalSyncRequest = {
  targetSystem: "external_crm";
  status: "pending_external_adapter";
  humanConfirmed: true;
  requestedAt: string;
};

export type MeetingMinutes = {
  customerId: string;
  summary: string;
  requirements: string[];
  painPoints: string[];
  decisionMakers: string[];
  actionItems: string[];
};

export type ContractRiskCode =
  | "PAYMENT_TERM_TOO_LONG"
  | "UNLIMITED_LIABILITY"
  | "ACCEPTANCE_CRITERIA_UNCLEAR";

export type ContractRisk = {
  code: ContractRiskCode;
  severity: "medium" | "high";
  clause: string;
  suggestion: string;
};

export type ContractReview = {
  customerId: string;
  contractTitle: string;
  keyFields: {
    paymentTermDays?: number;
    hasUnlimitedLiability: boolean;
    acceptanceCriteriaClear: boolean;
  };
  risks: ContractRisk[];
  reportSummary: string;
};

export type AfterSalesAnswer = {
  customerId: string;
  answer: string;
  escalationRequired: boolean;
  escalationReason?: string;
};

export type MaintenanceReminder = {
  customerId: string;
  productName: string;
  daysBeforeExpiry: 90 | 60 | 30;
  remindAt: string;
  contractEndDate: string;
};

export type ChannelContext = {
  partnerName: string;
  partnerLevel: string;
  authorizedRegions: string[];
  customerName: string;
  pricePolicy: string;
  registrationStatus: string;
  duplicateRisk: boolean;
  proposalVariables: {
    partnerName: string;
    partnerLevel: string;
    pricePolicy: string;
    authorizedRegions: string;
  };
};

export type CustomerSignal = {
  customerId: string;
  customerName: string;
  profileDimensions: string[];
  painPoints: string[];
  purchaseWindow: "near_term" | "unknown";
  competitorInvolved: boolean;
  actionSuggestions: string[];
  talkTracks: string[];
  evidenceSources: Array<"crm" | "manual_signal">;
};

export type BusinessFlowOutputs = {
  opportunity?: StructuredOpportunity;
  syncRequest?: ExternalSyncRequest;
  meetingMinutes?: MeetingMinutes;
  proposalJobId?: string;
  proposalJob?: ProposalJob;
  contractReview?: ContractReview;
  afterSalesAnswer?: AfterSalesAnswer;
  maintenanceReminders?: MaintenanceReminder[];
  channelContext?: ChannelContext;
  customerSignal?: CustomerSignal;
};

export type BusinessFlowPayload = Record<string, unknown> & {
  title?: string;
};

export type BusinessFlowRecord = {
  recordId: string;
  kind: BusinessFlowKind;
  status: BusinessFlowStatus;
  ownerUserId: string;
  ownerRole: UserRole;
  source: BusinessFlowSource;
  payload: BusinessFlowPayload;
  outputs: BusinessFlowOutputs;
  pendingInputs: string[];
  events: BusinessFlowEvent[];
  createdAt: string;
  updatedAt: string;
};

export type BusinessMetricDefinition = {
  module: BusinessFlowKind;
  name: string;
  description: string;
};

export type BusinessMetricCounter = {
  name: string;
  value: number;
};

export type BusinessMetrics = {
  definitions: BusinessMetricDefinition[];
  counters: BusinessMetricCounter[];
};
