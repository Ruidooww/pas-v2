export type PublicUser = {
  userId: string;
  username: string;
  displayName: string;
  role: "sales" | "presales" | "admin";
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: PublicUser;
};

export type QaCitation = {
  chunkId: string;
  documentId: string;
  title: string;
  source: string;
  score: number;
  page?: number;
  section?: string;
  position?: string;
  location?: string;
  snippet?: string;
};

export type QaAskResponse = {
  questionId: string;
  status: "answered" | "no_hit" | "error";
  answer: string;
  citations: QaCitation[];
};

export type CrmCustomerSummary = {
  customerId: string;
  name: string;
  industry: string;
  region: string;
  accountOwner: string;
};

export type CustomerAnalysisItem = {
  title: string;
  detail: string;
  basis: "evidence" | "inferred";
};

export type CustomerAnalysisResult = {
  analysisId: string;
  customerId: string;
  customerName: string;
  painPoints: CustomerAnalysisItem[];
  risks: CustomerAnalysisItem[];
  entryAngles: CustomerAnalysisItem[];
  recommendedCapabilities: CustomerAnalysisItem[];
  evidence: QaCitation[];
  narrativeSummary?: string;
  narrativeSource?: "llm" | "rule_based";
};

export type ProposalDraftSection = {
  sectionId: string;
  title: string;
  body: string;
};

export type ProposalDraft = {
  draftId: string;
  customerName: string;
  title: string;
  generatedAt: string;
  sections: ProposalDraftSection[];
  citations: QaCitation[];
  assumptions: string[];
};

export type ProposalProgressRecord = {
  step: string;
  status: "running" | "completed" | "failed";
  message: string;
  at: string;
};

export type ExportPackage = {
  packageId: string;
  customerId: string;
  payload: {
    proposalDraft: ProposalDraft;
  };
};

export type ProposalJob = {
  jobId: string;
  status: "running" | "completed" | "failed";
  progress: ProposalProgressRecord[];
  draft?: ProposalDraft;
  exportPackage?: ExportPackage;
  failureReason?: string;
};

export type ExportFormat = "docx" | "pptx" | "xlsx";

export type ExportFormatRecord =
  | { format: ExportFormat; status: "completed"; fileName: string; size: number }
  | { format: ExportFormat; status: "failed"; errorMessage: string };

export type ExportJob = {
  jobId: string;
  status: "completed" | "partial" | "failed";
  formats: ExportFormatRecord[];
};

export type ExportDownloadResponse = {
  fileName: string;
  contentType: string;
  contentBase64: string;
  size: number;
};

export type ExportTemplateStatus = "draft" | "active" | "disabled";

export type ExportTemplate = {
  templateId: string;
  name: string;
  category: "proposal";
  format: ExportFormat;
  version: string;
  fileName: string;
  status: ExportTemplateStatus;
  products: string[];
  scenarios: string[];
  industries: string[];
  tags: string[];
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  disabledReason?: string;
};

export type KnowledgeBlockStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "disabled"
  | "expired";

export type KnowledgeBlock = {
  blockId: string;
  title: string;
  product: string;
  scenario: string;
  body: string;
  citations: QaCitation[];
  tags: string[];
  source?: {
    type: "ragflow_chunk" | "manual" | "feedback" | "historical_proposal";
    referenceId?: string;
  };
  status: KnowledgeBlockStatus;
  version: number;
  ownerUserId: string;
  reviewerUserId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  reviewNote?: string;
};

export type KnowledgeDocumentParseStatus = "pending" | "parsing" | "done" | "failed";

export type KnowledgeDocumentMaterialType = "pdf" | "pptx" | "docx" | "xlsx" | "image" | "scan" | "other";

export type KnowledgeDocument = {
  documentId: string;
  title: string;
  product: string;
  materialType: KnowledgeDocumentMaterialType;
  sourceName: string;
  parseStatus: KnowledgeDocumentParseStatus;
  enabled: boolean;
  chunkCount: number;
  hitCount: number;
  badFeedbackCount: number;
  tags: string[];
  visibility:
    | { scope: "public" }
    | { scope: "roles"; roles: PublicUser["role"][] }
    | { scope: "users"; userIds: string[] };
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  disabledReason?: string;
  failureReason?: string;
  reparseRequestedAt?: string;
  reparseRequestedBy?: string;
  reparseReason?: string;
};

export type BusinessFlowKind =
  | "opportunity"
  | "meeting"
  | "contract_review"
  | "after_sales"
  | "channel"
  | "customer_signal";

export type BusinessFlowStatus = "pending_confirmation" | "confirmed" | "sync_pending" | "completed";

export type BusinessFlowRecord = {
  recordId: string;
  kind: BusinessFlowKind;
  status: BusinessFlowStatus;
  ownerUserId: string;
  source: {
    system: string;
    reference: string;
    capturedAt: string;
  };
  payload: Record<string, unknown>;
  outputs: {
    opportunity?: {
      customerName: string;
      demand: string;
      budgetAmount?: number;
      expectedCloseDate?: string;
      contactName?: string;
      stage: "discovery" | "proposal" | "negotiation" | "won";
      sourceSummary: string;
    };
    syncRequest?: {
      targetSystem: "external_crm";
      status: "pending_external_adapter";
      humanConfirmed: true;
      requestedAt: string;
    };
    meetingMinutes?: {
      customerId: string;
      summary: string;
      requirements: string[];
      painPoints: string[];
      decisionMakers: string[];
      actionItems: string[];
    };
    proposalJobId?: string;
    contractReview?: {
      contractTitle: string;
      reportSummary: string;
      risks: Array<{
        code: string;
        severity: "medium" | "high";
        clause: string;
        suggestion: string;
      }>;
    };
    afterSalesAnswer?: {
      answer: string;
      escalationRequired: boolean;
      escalationReason?: string;
    };
    maintenanceReminders?: Array<{
      productName: string;
      daysBeforeExpiry: 90 | 60 | 30;
      remindAt: string;
      contractEndDate: string;
    }>;
    channelContext?: {
      partnerName: string;
      customerName: string;
      duplicateRisk: boolean;
      proposalVariables: Record<string, string>;
    };
    customerSignal?: {
      customerName: string;
      purchaseWindow: "near_term" | "unknown";
      competitorInvolved: boolean;
      actionSuggestions: string[];
      talkTracks: string[];
      evidenceSources: string[];
    };
  };
  pendingInputs: string[];
  events: Array<{
    type: string;
    actorUserId: string;
    occurredAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMetrics = {
  definitions: Array<{
    module: BusinessFlowKind;
    name: string;
    description: string;
  }>;
  counters: Array<{
    name: string;
    value: number;
  }>;
};

export type PlatformChannelKind = "web" | "feishu" | "wecom" | "qq" | "wechat" | "mobile_h5";

export type PlatformDashboard = {
  filters: Record<string, string | undefined>;
  cards: Array<{
    key: string;
    title: string;
    value: number;
    unit?: string;
    trend?: "up" | "flat" | "down";
  }>;
  drilldowns: {
    salesFunnel: Array<{ stage: string; count: number }>;
    channelContribution: Array<{ channel: string; count: number }>;
    productMix: Array<{ product: string; count: number }>;
    knowledgeUsage: Array<{ metric: string; value: number }>;
    proposalConversion: Array<{ metric: string; value: number }>;
  };
  methodology: Array<{
    key: string;
    description: string;
  }>;
};

export type PlatformChannel = {
  channelId: string;
  kind: PlatformChannelKind;
  name: string;
  status: "active" | "adapter_pending" | "disabled";
  identityMapping: "pas_user" | "external_mapping" | "pending";
  pendingInputs: string[];
};

export type PlatformSession = {
  sessionId: string;
  channel: PlatformChannelKind;
  sourceRef: string;
  identity: {
    userId: string;
    role: PublicUser["role"];
    externalUserId: string;
    mappingStatus: "mapped" | "pending_external_mapping";
  };
  actions: Array<{
    type: "answer_knowledge" | "create_deliverable_task" | "archive_session";
    status: "completed" | "pending_external_adapter";
    summary: string;
    pendingInputs: string[];
  }>;
  notification?: {
    targetChannel: PlatformChannelKind;
    status: "queued" | "sent" | "pending_external_adapter";
    summary: string;
  };
  createdAt: string;
};

export type PlatformAgent = {
  agentId: string;
  name: string;
  purpose: string;
  status: "active" | "disabled";
  allowedScopes: string[];
  ownerRole: PublicUser["role"];
};

export type PlatformSkill = {
  skillId: string;
  name: string;
  description?: string;
  status: "pending_approval" | "approved" | "rejected";
  requestedScopes: string[];
  scan: {
    riskLevel: "low" | "medium" | "high";
    findings: string[];
  };
};

export type PlatformWorkflow = {
  workflowId: string;
  name: string;
  trigger: string;
  status: "active" | "disabled";
  complexity: "simple" | "controlled";
  agentIds: string[];
  skillIds: string[];
};

export type PlatformProduct = {
  productId: string;
  name: string;
  version: string;
  ownerTeam: string;
  status: "enabled" | "disabled";
  knowledgePartitionIds?: string[];
  proposalTemplateIds?: string[];
  exportTemplateIds?: string[];
  webhookEvents?: string[];
  apiVersion?: string;
  pluginDependencies?: string[];
  pendingInputs: string[];
};

export type PlatformCipSignal = {
  signalId: string;
  customerId: string;
  customerName: string;
  type:
    | "silent_customer"
    | "competitor_involved"
    | "personnel_change"
    | "purchase_window"
    | "security_incident"
    | "renewal_expansion";
  severity: "medium" | "high";
  suggestion: string;
};

export type PlatformTenant = {
  tenantId: string;
  organizationId: string;
  mode: "single_org" | "multi_org_reserved";
  isolationFields: string[];
  billingReserved: boolean;
  singleOrgCompatible: boolean;
};

export type PlatformSecurityReport = {
  totalEvents: number;
  eventsByType: Record<string, number>;
  sensitiveAlerts: Array<{
    auditId: string;
    type: string;
    severity: "info" | "warning" | "critical";
    summary: string;
  }>;
  permissionBoundaryChecks: Array<{
    key: string;
    status: "passed" | "pending_external_policy";
    summary: string;
  }>;
};

export type PlatformOverview = {
  dashboard: PlatformDashboard;
  channels: PlatformChannel[];
  recentSessions: PlatformSession[];
  agents: PlatformAgent[];
  skills: PlatformSkill[];
  workflows: PlatformWorkflow[];
  products: PlatformProduct[];
  cipSignals: PlatformCipSignal[];
  tenant: PlatformTenant;
  security: PlatformSecurityReport;
  trialReadiness: Array<{
    area: string;
    status: "code_ready" | "business_input_required";
    note: string;
  }>;
  updatedAt: string;
};
