import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { QaController } from "./qa.controller";
import type { QaService } from "./qa.service";

describe("QaController", () => {
  it("rejects blank questions before calling service", async () => {
    const service = {
      ask: vi.fn()
    } as unknown as QaService;
    const controller = new QaController(service);

    await expect(controller.ask({ query: " " })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.ask).not.toHaveBeenCalled();
  });

  it("delegates valid QA requests to QaService", async () => {
    const response = {
      questionId: "qa-1",
      status: "answered",
      answer: "需人工审核：answer",
      citations: []
    };
    const service = {
      ask: vi.fn().mockResolvedValue(response)
    } as unknown as QaService;
    const controller = new QaController(service);

    await expect(controller.ask({ query: "如何保护图纸？", userId: "user-1" })).resolves.toEqual(response);
    expect(service.ask).toHaveBeenCalledWith({
      query: "如何保护图纸？",
      userId: "user-1"
    });
  });
});
