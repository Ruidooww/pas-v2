import { Module } from "@nestjs/common";
import { createCrmConfig, type CrmConfig } from "./crm.config";
import { CrmController } from "./crm.controller";
import { MockCrmClient } from "./mock-crm.client";
import { CRM_CLIENT, CRM_CONFIG } from "./crm.tokens";
import type { CrmClient } from "./crm.types";

@Module({
  controllers: [CrmController],
  providers: [
    {
      provide: CRM_CONFIG,
      useFactory: (): CrmConfig => createCrmConfig()
    },
    {
      provide: CRM_CLIENT,
      useFactory: (config: CrmConfig): CrmClient => new MockCrmClient(config),
      inject: [CRM_CONFIG]
    }
  ],
  exports: [CRM_CLIENT]
})
export class CrmModule {}
