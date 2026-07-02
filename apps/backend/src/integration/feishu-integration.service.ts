import crypto from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import type { QaService } from "../qa/qa.service";
import type {
  FeishuCallbackEvent,
  FeishuCallbackHeaders,
  FeishuCallbackResponse,
  FeishuIntegrationConfig
} from "./feishu.types";
import { FeishuUserMappingStore } from "./feishu-user-mapping.store";

export class FeishuIntegrationService {
  private readonly userMappings = new FeishuUserMappingStore();

  constructor(
    private readonly config: FeishuIntegrationConfig,
    private readonly qaService: QaService
  ) {}

  async handleEvent(headers: FeishuCallbackHeaders, body: FeishuCallbackEvent): Promise<FeishuCallbackResponse> {
    if (!this.config.enabled) {
      return {
        status: "disabled"
      };
    }

    this.verifySignature(headers, body);

    if (body.type === "url_verification") {
      return {
        status: "verified",
        challenge: body.challenge
      };
    }

    const mappedUserId = this.userMappings.get(body.feishuUserId);
    const qaResponse = await this.qaService.ask({
      query: body.text,
      userId: mappedUserId || `feishu-public:${body.feishuUserId}`
    });

    return {
      status: "answered",
      messageId: body.messageId,
      qaStatus: qaResponse.status,
      answer: qaResponse.answer
    };
  }

  mapFeishuUser(feishuUserId: string, pasUserId: string): void {
    this.userMappings.set(feishuUserId, pasUserId);
  }

  private verifySignature(headers: FeishuCallbackHeaders, body: FeishuCallbackEvent): void {
    if (!this.config.webhookSecret) {
      throw new UnauthorizedException("Feishu webhook secret is not configured");
    }

    const expected = signFeishuCallback(this.config.webhookSecret, headers.timestamp, headers.nonce, body);
    if (!constantTimeEqual(headers.signature, expected)) {
      throw new UnauthorizedException("Invalid Feishu callback signature");
    }
  }
}

export function signFeishuCallback(
  secret: string,
  timestamp: string,
  nonce: string,
  body: FeishuCallbackEvent
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${JSON.stringify(body)}`)
    .digest("hex");
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
