import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { QaService } from "../qa/qa.service";
import { FeishuIntegrationService, signFeishuCallback } from "./feishu-integration.service";

describe("FeishuIntegrationService", () => {
  it("returns a stable disabled response when Feishu is not configured", async () => {
    const service = new FeishuIntegrationService(
      {
        enabled: false,
        webhookSecret: ""
      },
      { ask: vi.fn() } as unknown as QaService
    );

    await expect(
      service.handleEvent(
        {
          timestamp: "1",
          nonce: "n",
          signature: "bad"
        },
        {
          type: "message",
          messageId: "msg-1",
          feishuUserId: "ou_1",
          text: "How does IP-Guard work?"
        }
      )
    ).resolves.toEqual({
      status: "disabled"
    });
  });

  it("rejects enabled callbacks with an invalid signature", async () => {
    const service = createEnabledService();

    await expect(
      service.handleEvent(
        {
          timestamp: "100",
          nonce: "nonce-1",
          signature: "bad-signature"
        },
        {
          type: "message",
          messageId: "msg-1",
          feishuUserId: "ou_1",
          text: "How does IP-Guard work?"
        }
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("answers message callbacks through QaService using public knowledge identity when unmapped", async () => {
    const qaService = {
      ask: vi.fn().mockResolvedValue({
        questionId: "qa-1",
        status: "answered",
        answer: "Review required answer",
        citations: []
      })
    } as unknown as QaService;
    const service = new FeishuIntegrationService(
      {
        enabled: true,
        webhookSecret: "secret"
      },
      qaService
    );
    const body = {
      type: "message" as const,
      messageId: "msg-1",
      feishuUserId: "ou_1",
      text: "How does IP-Guard work?"
    };
    const timestamp = String(Math.floor(Date.now() / 1000));

    const response = await service.handleEvent(
      {
        timestamp,
        nonce: "nonce-1",
        signature: signFeishuCallback("secret", timestamp, "nonce-1", body)
      },
      body
    );

    expect(response).toEqual(
      expect.objectContaining({
        status: "answered",
        messageId: "msg-1",
        qaStatus: "answered"
      })
    );
    expect(qaService.ask).toHaveBeenCalledWith({
      query: "How does IP-Guard work?",
      userId: "feishu-public:ou_1"
    });
  });

  it("rejects stale callback timestamps", async () => {
    const service = createEnabledService();
    const body = {
      type: "message" as const,
      messageId: "msg-1",
      feishuUserId: "ou_1",
      text: "How does IP-Guard work?"
    };
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);

    await expect(
      service.handleEvent(
        {
          timestamp,
          nonce: "nonce-1",
          signature: signFeishuCallback("secret", timestamp, "nonce-1", body)
        },
        body
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects replayed callback nonces", async () => {
    const qaService = {
      ask: vi.fn().mockResolvedValue({
        questionId: "qa-1",
        status: "answered",
        answer: "Review required answer",
        citations: []
      })
    } as unknown as QaService;
    const service = new FeishuIntegrationService(
      {
        enabled: true,
        webhookSecret: "secret"
      },
      qaService
    );
    const body = {
      type: "message" as const,
      messageId: "msg-1",
      feishuUserId: "ou_1",
      text: "How does IP-Guard work?"
    };
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = {
      timestamp,
      nonce: "nonce-1",
      signature: signFeishuCallback("secret", timestamp, "nonce-1", body)
    };

    await expect(service.handleEvent(headers, body)).resolves.toEqual(
      expect.objectContaining({
        status: "answered"
      })
    );
    await expect(service.handleEvent(headers, body)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(qaService.ask).toHaveBeenCalledTimes(1);
  });
});

function createEnabledService(): FeishuIntegrationService {
  return new FeishuIntegrationService(
    {
      enabled: true,
      webhookSecret: "secret"
    },
    { ask: vi.fn() } as unknown as QaService
  );
}
