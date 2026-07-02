import type { CustomerAnalysisAuditEvent } from "./customer-analysis.types";

export class CustomerAnalysisAuditLogService {
  private readonly entries: CustomerAnalysisAuditEvent[] = [];

  record(event: CustomerAnalysisAuditEvent): void {
    this.entries.push({ ...event });
  }

  list(): CustomerAnalysisAuditEvent[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
