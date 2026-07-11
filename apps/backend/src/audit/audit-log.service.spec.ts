import { describe, expect, it } from "vitest";
import { AuditLogService } from "./audit-log.service";

describe("AuditLogService", () => {
  it("preserves structured non-secret model metadata", () => {
    const service = new AuditLogService();

    service.record({
      action: "ai_model_configuration",
      actorUserId: "admin-1",
      objectType: "ai_model_configuration",
      objectId: "generation-default",
      result: "success",
      metadata: {
        operation: "test",
        provider: "bailian",
        model: "qwen-plus",
        elapsedMs: 25
      }
    });

    expect(service.list()).toEqual([
      expect.objectContaining({
        action: "ai_model_configuration",
        metadata: expect.objectContaining({ operation: "test", elapsedMs: 25 })
      })
    ]);
  });
});
