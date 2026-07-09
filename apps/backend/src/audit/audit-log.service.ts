import type { PersistenceSink } from "../persistence/persistence-sink";
import { createPrefixedId } from "../ids";
import type { AuditEvent, AuditRecordInput } from "./audit.types";

export class AuditLogService {
  private readonly events: AuditEvent[] = [];

  constructor(private readonly sink?: PersistenceSink) {}

  seed(events: AuditEvent[]): void {
    this.events.push(...events);
  }

  record(input: AuditRecordInput): AuditEvent {
    const event: AuditEvent = {
      ...input,
      auditId: createAuditId(),
      occurredAt: input.occurredAt || new Date().toISOString()
    };
    this.events.push(event);
    this.sink?.mirrorAudit(event);
    return event;
  }

  list(): AuditEvent[] {
    return [...this.events];
  }
}

function createAuditId(): string {
  return createPrefixedId("audit");
}
