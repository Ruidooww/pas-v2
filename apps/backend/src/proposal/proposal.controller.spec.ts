import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ProposalController } from "./proposal.controller";
import type { ProposalService } from "./proposal.service";

describe("ProposalController", () => {
  const request = {
    user: {
      userId: "authenticated-user",
      username: "user@example.com",
      displayName: "Authenticated User",
      role: "presales" as const
    }
  };

  it("rejects blank customer id before starting generation", async () => {
    const service = {
      generate: vi.fn()
    } as unknown as ProposalService;
    const controller = new ProposalController(service);

    await expect(controller.generate(request, { customerId: " " })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.generate).not.toHaveBeenCalled();
  });

  it("delegates proposal generation to ProposalService using the authenticated user", async () => {
    const response = {
      jobId: "proposal-job-1",
      status: "completed",
      progress: [],
      request: {
        customerId: "demo-huaxin-manufacturing",
        userId: "user-1"
      },
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z"
    };
    const service = {
      generate: vi.fn().mockResolvedValue(response)
    } as unknown as ProposalService;
    const controller = new ProposalController(service);

    await expect(
      controller.generate(request, {
        customerId: "demo-huaxin-manufacturing",
        userId: "spoofed-user"
      })
    ).resolves.toEqual(response);
    expect(service.generate).toHaveBeenCalledWith({
      customerId: "demo-huaxin-manufacturing",
      userId: "authenticated-user",
      humanInputs: undefined
    });
  });

  it("delegates status lookup and retry", async () => {
    const response = {
      jobId: "proposal-job-1",
      status: "failed",
      progress: [],
      request: {
        customerId: "demo-huaxin-manufacturing"
      },
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z"
    };
    const service = {
      getJobOrThrow: vi.fn().mockReturnValue(response),
      retry: vi.fn().mockResolvedValue({
        ...response,
        status: "completed"
      })
    } as unknown as ProposalService;
    const controller = new ProposalController(service);

    expect(controller.getJob("proposal-job-1")).toEqual(response);
    await expect(controller.retry("proposal-job-1")).resolves.toEqual({
      ...response,
      status: "completed"
    });
    expect(service.getJobOrThrow).toHaveBeenCalledWith("proposal-job-1");
    expect(service.retry).toHaveBeenCalledWith("proposal-job-1");
  });
});
