import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { QaController } from "./qa.controller";
import type { QaService } from "./qa.service";

const request = {
  user: {
    userId: "authenticated-user",
    username: "user@example.com",
    displayName: "Authenticated User",
    role: "sales" as const,
    organizationUnitId: "org-sales",
    projectGroupIds: []
  }
};

describe("QaController", () => {
  it("rejects blank questions before calling service", async () => {
    const service = {
      ask: vi.fn()
    } as unknown as QaService;
    const controller = new QaController(service);

    await expect(controller.ask(request, { query: " " })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.ask).not.toHaveBeenCalled();
  });

  it("delegates valid QA requests to QaService using the authenticated user", async () => {
    const response = {
      questionId: "qa-1",
      status: "answered",
      answer: "Review required answer",
      citations: []
    };
    const service = {
      ask: vi.fn().mockResolvedValue(response)
    } as unknown as QaService;
    const controller = new QaController(service);

    await expect(
      controller.ask(request, {
        query: "How does IP-Guard protect drawings?",
        userId: "spoofed-user"
      })
    ).resolves.toEqual(response);
    expect(service.ask).toHaveBeenCalledWith({
      query: "How does IP-Guard protect drawings?",
      userId: "authenticated-user",
      user: request.user
    });
  });
});
