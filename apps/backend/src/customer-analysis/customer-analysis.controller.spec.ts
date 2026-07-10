import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CustomerAnalysisController } from "./customer-analysis.controller";
import type { CustomerAnalysisService } from "./customer-analysis.service";

describe("CustomerAnalysisController", () => {
  const request = {
    user: {
      userId: "authenticated-user",
      username: "user@example.com",
      displayName: "Authenticated User",
      role: "technical" as const,
      organizationUnitId: "org-technical-presales",
      projectGroupIds: []
    }
  };

  it("rejects missing customer id", async () => {
    const service = { analyze: vi.fn() } as unknown as CustomerAnalysisService;
    const controller = new CustomerAnalysisController(service);

    await expect(controller.analyze(request, { customerId: " " })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.analyze).not.toHaveBeenCalled();
  });

  it("delegates valid requests to CustomerAnalysisService using the authenticated user", async () => {
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
      controller.analyze(request, {
        customerId: "demo-huaxin-manufacturing",
        userId: "spoofed-user"
      })
    ).resolves.toEqual(response);
    expect(service.analyze).toHaveBeenCalledWith({
      customerId: "demo-huaxin-manufacturing",
      userId: "authenticated-user",
      user: request.user
    });
  });
});
