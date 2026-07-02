import type { ExportAuditEvent } from "./export.types";

export class ExportAuditLogService {
  private readonly events: ExportAuditEvent[] = [];

  record(event: ExportAuditEvent): void {
    this.events.push(event);
  }

  list(): ExportAuditEvent[] {
    return [...this.events];
  }
}
