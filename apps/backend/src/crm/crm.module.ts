import { Module } from "@nestjs/common";
import { createCrmConfig, type CrmConfig } from "./crm.config";
import { CrmController } from "./crm.controller";
import { ExternalCrmClient } from "./external-crm.client";
import { MockCrmClient } from "./mock-crm.client";
import { CRM_CLIENT, CRM_CONFIG } from "./crm.tokens";
import type { CrmClient } from "./crm.types";

export function createCrmClient(config: CrmConfig): CrmClient {
  return config.clientMode === "external" ? new ExternalCrmClient(config) : new MockCrmClient();
}

@Module({
  controllers: [CrmController],
  providers: [
    {
      provide: CRM_CONFIG,
      useFactory: (): CrmConfig => createCrmConfig()
    },
    {
      provide: CRM_CLIENT,
      useFactory: createCrmClient,
      inject: [CRM_CONFIG]
    }
  ],
  exports: [CRM_CLIENT]
})
export class CrmModule {}
