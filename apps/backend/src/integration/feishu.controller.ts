import { Body, Controller, Headers, Inject, Post } from "@nestjs/common";
import { FeishuIntegrationService } from "./feishu-integration.service";
import { FEISHU_INTEGRATION_SERVICE } from "./integration.tokens";
import type { FeishuCallbackEvent, FeishuCallbackResponse } from "./feishu.types";

@Controller("api/integrations/feishu")
export class FeishuController {
  constructor(@Inject(FEISHU_INTEGRATION_SERVICE) private readonly feishu: FeishuIntegrationService) {}

  @Post("events")
  async handleEvent(
    @Headers("x-feishu-timestamp") timestamp: string,
    @Headers("x-feishu-nonce") nonce: string,
    @Headers("x-feishu-signature") signature: string,
    @Body() body: FeishuCallbackEvent
  ): Promise<FeishuCallbackResponse> {
    return this.feishu.handleEvent(
      {
        timestamp,
        nonce,
        signature
      },
      body
    );
  }
}
