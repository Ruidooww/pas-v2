import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import type { AuditLogService } from "../audit/audit-log.service";
import { AUDIT_LOG } from "../audit/audit.tokens";
import { PersistenceModule } from "../persistence/persistence.module";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { CustomerAnalysisModule } from "../customer-analysis/customer-analysis.module";
import { CUSTOMER_ANALYSIS_SERVICE } from "../customer-analysis/customer-analysis.tokens";
import type { CustomerAnalysisService } from "../customer-analysis/customer-analysis.service";
import { LlmModule } from "../llm/llm.module";
import { LLM_CLIENT } from "../llm/llm.tokens";
import type { LlmClientPort } from "../llm/llm.types";
import { ProposalAuditLogService } from "./proposal-audit-log.service";
import { ProposalController } from "./proposal.controller";
import { LocalProposalDraftProvider } from "./proposal-draft.provider";
import { ModelProposalDraftProvider } from "./model-proposal-draft.provider";
import { ProposalJobStoreService } from "./proposal-job-store.service";
import { ProposalService } from "./proposal.service";
import {
  PROPOSAL_AUDIT_LOG,
  PROPOSAL_DRAFT_PROVIDER,
  PROPOSAL_JOB_STORE,
  PROPOSAL_SERVICE
} from "./proposal.tokens";
import type { ProposalDraftProvider } from "./proposal.types";

@Module({
  controllers: [ProposalController],
  imports: [CustomerAnalysisModule, PersistenceModule, LlmModule, AuditModule],
  providers: [
    {
      provide: PROPOSAL_AUDIT_LOG,
      useFactory: (): ProposalAuditLogService => new ProposalAuditLogService()
    },
    {
      provide: PROPOSAL_JOB_STORE,
      useFactory: async (sink: PersistenceSink): Promise<ProposalJobStoreService> => {
        const store = new ProposalJobStoreService(sink);
        store.seed(await sink.loadProposalJobs());
        return store;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: PROPOSAL_DRAFT_PROVIDER,
      useFactory: (llm: LlmClientPort, audit: AuditLogService): ProposalDraftProvider =>
        new ModelProposalDraftProvider(llm, new LocalProposalDraftProvider(), audit),
      inject: [LLM_CLIENT, AUDIT_LOG]
    },
    {
      provide: PROPOSAL_SERVICE,
      useFactory: (
        customerAnalysisService: CustomerAnalysisService,
        jobStore: ProposalJobStoreService,
        auditLog: ProposalAuditLogService,
        draftProvider: ProposalDraftProvider
      ): ProposalService => new ProposalService(customerAnalysisService, jobStore, auditLog, draftProvider),
      inject: [CUSTOMER_ANALYSIS_SERVICE, PROPOSAL_JOB_STORE, PROPOSAL_AUDIT_LOG, PROPOSAL_DRAFT_PROVIDER]
    }
  ],
  exports: [PROPOSAL_SERVICE]
})
export class ProposalModule {}
