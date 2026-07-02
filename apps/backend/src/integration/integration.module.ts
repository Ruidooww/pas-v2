import { Module } from "@nestjs/common";
import { QaModule } from "../qa/qa.module";
import { QA_SERVICE } from "../qa/qa.tokens";
import type { QaService } from "../qa/qa.service";
import { FeishuController } from "./feishu.controller";
import { FeishuIntegrationService } from "./feishu-integration.service";
import { createFeishuIntegrationConfig } from "./integration.config";
import { FEISHU_INTEGRATION_CONFIG, FEISHU_INTEGRATION_SERVICE } from "./integration.tokens";
import type { FeishuIntegrationConfig } from "./feishu.types";

@Module({
  controllers: [FeishuController],
  imports: [QaModule],
  providers: [
    {
      provide: FEISHU_INTEGRATION_CONFIG,
      useFactory: (): FeishuIntegrationConfig => createFeishuIntegrationConfig()
    },
    {
      provide: FEISHU_INTEGRATION_SERVICE,
      useFactory: (config: FeishuIntegrationConfig, qaService: QaService): FeishuIntegrationService =>
        new FeishuIntegrationService(config, qaService),
      inject: [FEISHU_INTEGRATION_CONFIG, QA_SERVICE]
    }
  ],
  exports: [FEISHU_INTEGRATION_SERVICE]
})
export class IntegrationModule {}
