import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { BusinessFlowController } from "./business-flow.controller";
import type { BusinessFlowService } from "./business-flow.service";

describe("BusinessFlowController", () => {
  const request = {
    user: {
      userId: "authenticated-user",
      username: "user@example.com",
      displayName: "Authenticated User",
      role: "sales" as const
    }
  };

  it("rejects blank opportunity text before calling the service", async () => {
    const service = { extractOpportunity: vi.fn() } as unknown as BusinessFlowService;
    const controller = new BusinessFlowController(service);

    await expect(
      controller.extractOpportunity(request, {
        text: " ",
        sourceRef: "note-1"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.extractOpportunity).not.toHaveBeenCalled();
  });

  it("delegates opportunity extraction with the authenticated user", async () => {
    const response = { recordId: "bf-1" };
    const service = {
      extractOpportunity: vi.fn().mockResolvedValue(response)
    } as unknown as BusinessFlowService;
    const controller = new BusinessFlowController(service);

    await expect(
      controller.extractOpportunity(request, {
        text: "客户：华信精工；需求：防泄漏",
        sourceRef: "note-1"
      })
    ).resolves.toEqual(response);
    expect(service.extractOpportunity).toHaveBeenCalledWith(
      {
        text: "客户：华信精工；需求：防泄漏",
        sourceRef: "note-1"
      },
      request.user
    );
  });

  it("delegates confirmation, sync, records, and metrics", () => {
    const service = {
      confirmOpportunity: vi.fn().mockReturnValue({ recordId: "bf-1", status: "confirmed" }),
      requestOpportunitySync: vi.fn().mockReturnValue({ recordId: "bf-1", status: "sync_pending" }),
      listRecords: vi.fn().mockReturnValue([{ recordId: "bf-1" }]),
      getMetrics: vi.fn().mockReturnValue({ definitions: [], counters: [] })
    } as unknown as BusinessFlowService;
    const controller = new BusinessFlowController(service);

    expect(
      controller.confirmOpportunity(
        "bf-1",
        {
          opportunity: {
            customerName: "华信精工",
            demand: "终端数据防泄漏",
            stage: "proposal",
            sourceSummary: "manual text"
          }
        },
        request
      )
    ).toEqual({
      recordId: "bf-1",
      status: "confirmed"
    });
    expect(controller.requestOpportunitySync("bf-1", request)).toEqual({
      recordId: "bf-1",
      status: "sync_pending"
    });
    expect(controller.listRecords(request)).toEqual({ records: [{ recordId: "bf-1" }] });
    expect(controller.getMetrics(request)).toEqual({ definitions: [], counters: [] });
  });

  it("validates meeting and contract required fields", async () => {
    const service = {
      summarizeMeeting: vi.fn(),
      reviewContract: vi.fn()
    } as unknown as BusinessFlowService;
    const controller = new BusinessFlowController(service);

    await expect(
      controller.summarizeMeeting(request, { customerId: "demo", transcript: " ", sourceRef: "meeting-1" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(() =>
      controller.reviewContract(request, {
        customerId: "demo",
        contractTitle: "合同",
        contractText: "",
        sourceRef: "contract-1"
      })
    ).toThrow(BadRequestException);
  });
});
