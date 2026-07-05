import { Module } from "@nestjs/common";
import { CRM_CLIENT } from "../crm/crm.tokens";
import type { CrmClient } from "../crm/crm.types";
import { CrmModule } from "../crm/crm.module";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { ProposalModule } from "../proposal/proposal.module";
import type { ProposalService } from "../proposal/proposal.service";
import { PROPOSAL_SERVICE } from "../proposal/proposal.tokens";
import { BusinessFlowController } from "./business-flow.controller";
import { BusinessFlowService } from "./business-flow.service";
import { BusinessFlowStoreService } from "./business-flow-store.service";
import { BUSINESS_FLOW_SERVICE, BUSINESS_FLOW_STORE } from "./business-flow.tokens";

@Module({
  controllers: [BusinessFlowController],
  imports: [CrmModule, ProposalModule],
  providers: [
    {
      provide: BUSINESS_FLOW_STORE,
      useFactory: async (sink: PersistenceSink): Promise<BusinessFlowStoreService> => {
        const store = new BusinessFlowStoreService(sink);
        store.seed(await sink.loadBusinessFlowRecords());
        return store;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: BUSINESS_FLOW_SERVICE,
      useFactory: (
        crmClient: CrmClient,
        store: BusinessFlowStoreService,
        proposalService: ProposalService
      ): BusinessFlowService => new BusinessFlowService(crmClient, store, proposalService),
      inject: [CRM_CLIENT, BUSINESS_FLOW_STORE, PROPOSAL_SERVICE]
    }
  ],
  exports: [BUSINESS_FLOW_SERVICE]
})
export class BusinessFlowModule {}
