export type AuditAction =
  | "login"
  | "user_created"
  | "user_imported"
  | "qa"
  | "retrieval"
  | "knowledge"
  | "proposal_generation"
  | "export"
  | "download"
  | "feedback";

export type AuditResult = "success" | "failure";

export type AuditEvent = {
  auditId: string;
  action: AuditAction;
  actorUserId?: string;
  objectType: string;
  objectId: string;
  result: AuditResult;
  failureReason?: string;
  occurredAt: string;
};

export type AuditRecordInput = Omit<AuditEvent, "auditId" | "occurredAt"> & {
  occurredAt?: string;
};
