import { Module } from "@nestjs/common";
import { BusinessFlowModule } from "../business-flow/business-flow.module";
import type { BusinessFlowService } from "../business-flow/business-flow.service";
import { BUSINESS_FLOW_SERVICE } from "../business-flow/business-flow.tokens";
import { PersistenceModule } from "../persistence/persistence.module";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
import { PlatformStoreService } from "./platform-store.service";
import { PLATFORM_SERVICE, PLATFORM_STORE } from "./platform.tokens";

@Module({
  controllers: [PlatformController],
  imports: [BusinessFlowModule, PersistenceModule],
  providers: [
    {
      provide: PLATFORM_STORE,
      useFactory: async (sink: PersistenceSink): Promise<PlatformStoreService> => {
        const store = new PlatformStoreService(sink);
        store.seed(await sink.loadPlatformState());
        return store;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: PLATFORM_SERVICE,
      useFactory: (store: PlatformStoreService, businessFlowService: BusinessFlowService): PlatformService =>
        new PlatformService(store, businessFlowService),
      inject: [PLATFORM_STORE, BUSINESS_FLOW_SERVICE]
    }
  ],
  exports: [PLATFORM_SERVICE]
})
export class PlatformModule {}
