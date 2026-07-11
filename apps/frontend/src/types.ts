export type PublicUser = {
  userId: string;
  username: string;
  displayName: string;
  role: "sales" | "technical" | "admin";
  organizationUnitId: string;
  projectGroupIds: string[];
  active: boolean;
};

export type UserRole = PublicUser["role"];

export type UpdateUserRequest = {
  displayName?: string;
  role?: UserRole;
  active?: boolean;
  organizationUnitId?: string;
  projectGroupIds?: string[];
};

export type OrganizationUnitKind = "company" | "department" | "team";

export type OrganizationUnit = {
  unitId: string;
  name: string;
  kind: OrganizationUnitKind;
  parentUnitId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectGroup = {
  projectGroupId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationCatalog = {
  units: OrganizationUnit[];
  projectGroups: ProjectGroup[];
};

export type AuditEvent = {
  auditId: string;
  action: string;
  actorUserId?: string;
  objectType: string;
  objectId: string;
  result: "success" | "failure";
  failureReason?: string;
  metadata?: Record<string, string | number | boolean | null>;
  occurredAt: string;
};

export type SystemSettingStatus = "configured" | "default" | "enabled" | "disabled" | "missing";

export type SystemSettingItem = {
  group: "ragflow" | "llm" | "storage" | "database" | "export" | "branding";
  key: string;
  label: string;
  value: string;
  status: SystemSettingStatus;
  secret: boolean;
};

export type SystemPathStatus = {
  label: string;
  path: string;
  exists: boolean;
  writable: boolean;
  fileCount: number;
  totalBytes: number;
  truncated: boolean;
};

export type LoginBranding = {
  title: string;
  subtitle: string;
  logoUrl?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type UpdateLoginBrandingRequest = {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
};

export type SystemOverview = {
  generatedAt: string;
  settings: SystemSettingItem[];
  paths: SystemPathStatus[];
  branding: LoginBranding;
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

export type WorkbenchMetric = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
};

export type WorkbenchTaskScope = "mine" | "team";

export type WorkbenchTask = {
  taskId: string;
  title: string;
  customerName: string;
  owner: string;
  status: "pending" | "in_progress" | "blocked" | "done";
  priority: "high" | "medium" | "low";
  dueAt: string;
  source: "crm" | "proposal" | "qa" | "manual";
};

export type WorkbenchActivity = {
  activityId: string;
  title: string;
  description: string;
  happenedAt: string;
};

export type WorkbenchOverview = {
  generatedAt: string;
  metrics: WorkbenchMetric[];
  tasks: WorkbenchTask[];
  activities: WorkbenchActivity[];
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
  request: {
    customerId: string;
    userId?: string;
  };
  progress: ProposalProgressRecord[];
  createdAt: string;
  updatedAt: string;
  draft?: ProposalDraft;
  exportPackage?: ExportPackage;
  failureReason?: string;
};

export type ProposalLibraryItem = {
  libraryId: string;
  title: string;
  customerName: string;
  status: "review_ready" | "export_ready" | "sample";
  source: "generated" | "mock";
  formats: ExportFormat[];
  tags: string[];
  updatedAt: string;
};

export type ExportFormat = "docx" | "pptx" | "xlsx";

export type ExportFormatRecord =
  | { format: ExportFormat; status: "completed"; fileName: string; size: number }
  | { format: ExportFormat; status: "failed"; errorMessage: string };

export type ExportJob = {
  jobId: string;
  sourcePackageId: string;
  customerId: string;
  userId: string;
  status: "completed" | "partial" | "failed";
  formats: ExportFormatRecord[];
  createdAt: string;
  updatedAt: string;
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

export type KnowledgeDocumentVisibility =
  | { scope: "public" }
  | { scope: "roles"; roles: PublicUser["role"][] }
  | { scope: "users"; userIds: string[] }
  | { scope: "organization_units"; organizationUnitIds: string[] }
  | { scope: "project_groups"; projectGroupIds: string[] };

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
  visibility: KnowledgeDocumentVisibility;
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

export type PrimaryMenuKey =
  | "workbench"
  | "customers"
  | "knowledge_delivery"
  | "business_loop"
  | "analytics_ops"
  | "system";

export type SecondaryMenuKey =
  | "overview"
  | "my_tasks"
  | "team_tasks"
  | "customer_management"
  | "customer_insights"
  | "proposal_tasks"
  | "proposal_library"
  | "qa"
  | "documents"
  | "knowledge_blocks"
  | "templates"
  | "export_jobs"
  | "opportunities"
  | "meeting_minutes"
  | "contracts_after_sales"
  | "customer_feedback"
  | "platform_governance"
  | "analytics"
  | "account_management"
  | "audit_logs"
  | "data_attachments"
  | "secondary_menu_config"
  | "ai_model_access"
  | "system_settings";

export type SecondaryMenuDefinition = {
  key: SecondaryMenuKey;
  label: string;
  route: string;
  roles: PublicUser["role"][];
  order: number;
};

export type PrimaryMenuDefinition = {
  key: PrimaryMenuKey;
  label: string;
  icon: string;
  order: number;
  children: SecondaryMenuDefinition[];
};

export type SecondaryMenuOverride = {
  primaryKey: PrimaryMenuKey;
  secondaryKey: SecondaryMenuKey;
  visible: boolean;
  order: number;
  alias?: string;
  roles: PublicUser["role"][];
  isDefault?: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type EffectiveSecondaryMenuItem = SecondaryMenuDefinition & {
  visible: true;
  label: string;
  isDefault: boolean;
};

export type EffectivePrimaryMenuItem = Omit<PrimaryMenuDefinition, "children"> & {
  children: EffectiveSecondaryMenuItem[];
  defaultSecondaryKey: SecondaryMenuKey;
};

export type MenuConfiguration = {
  defaults: PrimaryMenuDefinition[];
  overrides: SecondaryMenuOverride[];
};

export type UpdateSecondaryMenuOverrideRequest = {
  primaryKey: PrimaryMenuKey;
  secondaryKey: SecondaryMenuKey;
  visible?: boolean;
  order?: number;
  alias?: string;
  roles?: PublicUser["role"][];
  isDefault?: boolean;
};

export type AiModelProvider = "bailian" | "deepseek" | "openai" | "custom";

export type AiModelErrorCode =
  | "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"
  | "MODEL_CONFIGURATION_INVALID"
  | "MODEL_API_KEY_REQUIRED"
  | "MODEL_ENDPOINT_NOT_ALLOWED"
  | "MODEL_PERSISTENCE_UNAVAILABLE"
  | "MODEL_AUTHENTICATION_FAILED"
  | "MODEL_ENDPOINT_OR_MODEL_NOT_FOUND"
  | "MODEL_RATE_LIMITED"
  | "MODEL_PROVIDER_UNAVAILABLE"
  | "MODEL_REQUEST_TIMEOUT"
  | "MODEL_RESPONSE_INVALID";

export type AiModelCandidateRequest = {
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutSeconds: number;
};

export type AiModelTestResult = {
  ok: boolean;
  provider: AiModelProvider;
  model: string;
  elapsedMs: number;
  errorCode?: AiModelErrorCode;
};

export type AiModelGenerationOverview = {
  status: "running" | "not_configured" | "error";
  source: "database" | "environment" | "mock";
  provider?: AiModelProvider;
  baseUrl?: string;
  model?: string;
  keyConfigured: boolean;
  timeoutSeconds: number;
  errorCode?: AiModelErrorCode;
  lastTestStatus?: "passed" | "failed";
  lastTestedAt?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type SavedAiModelConfigurationOverview = {
  enabled: boolean;
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  keyConfigured: boolean;
  timeoutSeconds: number;
  lastTestStatus: "passed" | "failed";
  lastTestedAt: string;
  updatedBy: string;
  updatedAt: string;
};

export type AiModelOverview = {
  providers: Array<{ provider: AiModelProvider; label: string; defaultBaseUrl: string }>;
  generation: AiModelGenerationOverview;
  savedConfiguration?: SavedAiModelConfigurationOverview;
};

export type RagflowModelOverview = {
  status: "ok" | "error" | "disabled";
  baseUrl: string;
  dataset?: {
    datasetId: string;
    name?: string;
    embeddingModel?: string;
    rerankerModel?: string;
    chatModel?: string;
    language?: string;
    chunkMethod?: string;
    documentCount?: number;
    chunkCount?: number;
  };
  unavailableFields: string[];
  errorKind?: string;
  refreshedAt: string;
};
