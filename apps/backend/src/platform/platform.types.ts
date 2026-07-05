import type { UserRole } from "../auth/auth.types";

export type PlatformChannelKind = "web" | "feishu" | "wecom" | "qq" | "wechat" | "mobile_h5";
export type PlatformChannelStatus = "active" | "adapter_pending" | "disabled";

export type PlatformChannel = {
  channelId: string;
  kind: PlatformChannelKind;
  name: string;
  status: PlatformChannelStatus;
  identityMapping: "pas_user" | "external_mapping" | "pending";
  pendingInputs: string[];
};

export type PlatformSession = {
  sessionId: string;
  channel: PlatformChannelKind;
  sourceRef: string;
  identity: {
    userId: string;
    role: UserRole;
    externalUserId: string;
    mappingStatus: "mapped" | "pending_external_mapping";
  };
  messages: Array<{
    messageId: string;
    direction: "inbound" | "outbound";
    text: string;
    at: string;
  }>;
  actions: PlatformChannelAction[];
  notification?: PlatformNotification;
  archivedAt: string;
  createdAt: string;
};

export type PlatformChannelAction = {
  actionId: string;
  type: "answer_knowledge" | "create_deliverable_task" | "archive_session";
  status: "completed" | "pending_external_adapter";
  summary: string;
  pendingInputs: string[];
};

export type PlatformNotification = {
  notificationId: string;
  targetChannel: PlatformChannelKind;
  status: "queued" | "sent" | "pending_external_adapter";
  summary: string;
  createdAt: string;
};

export type AgentDefinition = {
  agentId: string;
  name: string;
  purpose: string;
  status: "active" | "disabled";
  allowedScopes: string[];
  ownerRole: UserRole;
};

export type SkillDefinition = {
  skillId: string;
  name: string;
  description: string;
  status: "pending_approval" | "approved" | "rejected";
  requestedScopes: string[];
  packageManifest: string;
  scan: {
    riskLevel: "low" | "medium" | "high";
    findings: string[];
  };
  importedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowDefinition = {
  workflowId: string;
  name: string;
  trigger: string;
  status: "active" | "disabled";
  complexity: "simple" | "controlled";
  agentIds: string[];
  skillIds: string[];
};

export type WorkflowExecution = {
  executionId: string;
  workflowId: string;
  actorUserId: string;
  status: "completed" | "blocked";
  input: Record<string, unknown>;
  outputSummary: string;
  steps: Array<{
    stepId: string;
    name: string;
    status: "completed" | "blocked";
    summary: string;
  }>;
  createdAt: string;
};

export type DashboardFilter = {
  department?: string;
  product?: string;
  channel?: string;
  from?: string;
  to?: string;
};

export type DashboardSnapshot = {
  filters: DashboardFilter;
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

export type ProductRegistration = {
  productId: string;
  name: string;
  version: string;
  ownerTeam: string;
  status: "enabled" | "disabled";
  knowledgePartitionIds: string[];
  proposalTemplateIds: string[];
  exportTemplateIds: string[];
  webhookEvents: string[];
  apiVersion: string;
  pluginDependencies: string[];
  pendingInputs: string[];
  createdAt: string;
  updatedAt: string;
};

export type CipSignalType =
  | "silent_customer"
  | "competitor_involved"
  | "personnel_change"
  | "purchase_window"
  | "security_incident"
  | "renewal_expansion";

export type CipSignal = {
  signalId: string;
  customerId: string;
  customerName: string;
  type: CipSignalType;
  severity: "medium" | "high";
  evidence: string;
  suggestion: string;
  createdAt: string;
};

export type TenantReservation = {
  tenantId: string;
  organizationId: string;
  mode: "single_org" | "multi_org_reserved";
  isolationFields: string[];
  billingReserved: boolean;
  singleOrgCompatible: boolean;
};

export type PlatformAuditEventType =
  | "channel_message"
  | "skill_import"
  | "skill_approval"
  | "agent_execution"
  | "product_registry"
  | "cip_signal"
  | "security_alert"
  | "api_call"
  | "webhook_call";

export type PlatformAuditEvent = {
  auditId: string;
  type: PlatformAuditEventType;
  actorUserId: string;
  severity: "info" | "warning" | "critical";
  resource: string;
  summary: string;
  occurredAt: string;
};

export type SecurityReport = {
  totalEvents: number;
  eventsByType: Record<string, number>;
  sensitiveAlerts: PlatformAuditEvent[];
  permissionBoundaryChecks: Array<{
    key: string;
    status: "passed" | "pending_external_policy";
    summary: string;
  }>;
};

export type PlatformState = {
  stateId: string;
  channels: PlatformChannel[];
  sessions: PlatformSession[];
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  workflows: WorkflowDefinition[];
  executions: WorkflowExecution[];
  products: ProductRegistration[];
  cipSignals: CipSignal[];
  tenant: TenantReservation;
  auditEvents: PlatformAuditEvent[];
  updatedAt: string;
};

export type PlatformOverview = {
  dashboard: DashboardSnapshot;
  channels: PlatformChannel[];
  recentSessions: PlatformSession[];
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  workflows: WorkflowDefinition[];
  products: ProductRegistration[];
  cipSignals: CipSignal[];
  tenant: TenantReservation;
  security: SecurityReport;
  trialReadiness: Array<{
    area: string;
    status: "code_ready" | "business_input_required";
    note: string;
  }>;
  updatedAt: string;
};

export type RouteMessageRequest = {
  channel: PlatformChannelKind;
  externalUserId: string;
  text: string;
  sourceRef: string;
};

export type RouteMessageResult = {
  session: PlatformSession;
  notification: PlatformNotification;
  auditEvent: PlatformAuditEvent;
};

export type ImportSkillRequest = {
  name: string;
  description: string;
  requestedScopes: string[];
  packageManifest: string;
};

export type RunWorkflowRequest = {
  workflowId: string;
  input: Record<string, unknown>;
};

export type RegisterProductRequest = {
  name: string;
  version: string;
  ownerTeam: string;
  knowledgePartitionIds?: string[];
  proposalTemplateIds?: string[];
  exportTemplateIds?: string[];
  webhookEvents?: string[];
  apiVersion?: string;
  pluginDependencies?: string[];
};

export type DetectCipSignalsRequest = {
  customerId: string;
  customerName: string;
  evidenceText: string;
};
