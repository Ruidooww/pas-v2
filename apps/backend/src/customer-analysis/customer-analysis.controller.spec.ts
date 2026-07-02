import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CustomerAnalysisController } from "./customer-analysis.controller";
import type { CustomerAnalysisService } from "./customer-analysis.service";

describe("CustomerAnalysisController", () => {
  it("rejects missing customer id", async () => {
    const service = { analyze: vi.fn() } as unknown as CustomerAnalysisService;
    const controller = new CustomerAnalysisController(service);

    await expect(controller.analyze({ customerId: " " })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.analyze).not.toHaveBeenCalled();
  });

  it("delegates valid requests to CustomerAnalysisService", async () => {
    const response = {
      analysisId: "ca-1",
      status: "completed",
      customerId: "demo-huaxin-manufacturing",
      customerName: "华信精工",
      painPoints: [],
      risks: [],
      entryAngles: [],
      recommendedCapabilities: [],
      evidence: []
    };
    const service = { analyze: vi.fn().mockResolvedValue(response) } as unknown as CustomerAnalysisService;
    const controller = new CustomerAnalysisController(service);

    await expect(
      controller.analyze({
        customerId: "demo-huaxin-manufacturing",
        userId: "user-1"
      })
    ).resolves.toEqual(response);
    expect(service.analyze).toHaveBeenCalledWith({
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1"
    });
  });
});
