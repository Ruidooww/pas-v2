import type { QaAuditEvent } from "./qa.types";

export class QaAuditLogService {
  private readonly entries: QaAuditEvent[] = [];

  record(event: QaAuditEvent): void {
    this.entries.push({ ...event });
  }

  list(): QaAuditEvent[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
