import type { AuditEvent, AuditRecordInput } from "./audit.types";

export class AuditLogService {
  private readonly events: AuditEvent[] = [];

  record(input: AuditRecordInput): AuditEvent {
    const event: AuditEvent = {
      ...input,
      auditId: createAuditId(),
      occurredAt: input.occurredAt || new Date().toISOString()
    };
    this.events.push(event);
    return event;
  }

  list(): AuditEvent[] {
    return [...this.events];
  }
}

function createAuditId(): string {
  return `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
