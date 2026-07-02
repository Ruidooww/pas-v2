import type { ProposalAuditEvent } from "./proposal.types";

export class ProposalAuditLogService {
  private readonly events: ProposalAuditEvent[] = [];

  record(event: ProposalAuditEvent): void {
    this.events.push(event);
  }

  list(): ProposalAuditEvent[] {
    return [...this.events];
  }
}
