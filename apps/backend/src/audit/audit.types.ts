export type AuditAction =
  | "login"
  | "user_created"
  | "user_listed"
  | "user_updated"
  | "user_imported"
  | "qa"
  | "retrieval"
  | "knowledge"
  | "proposal_generation"
  | "export"
  | "download"
  | "feedback"
  | "menu_configuration"
  | "organization"
  | "ai_model_configuration"
  | "llm_generation";

export type AuditResult = "success" | "failure";

export type AuditEvent = {
  auditId: string;
  action: AuditAction;
  actorUserId?: string;
  objectType: string;
  objectId: string;
  result: AuditResult;
  failureReason?: string;
  metadata?: Record<string, string | number | boolean | null>;
  occurredAt: string;
};

export type AuditRecordInput = Omit<AuditEvent, "auditId" | "occurredAt"> & {
  occurredAt?: string;
};
