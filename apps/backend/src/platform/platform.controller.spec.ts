import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PlatformController } from "./platform.controller";
import type { PlatformService } from "./platform.service";

describe("PlatformController", () => {
  const request = {
    user: {
      userId: "admin-1",
      username: "admin@example.com",
      displayName: "Admin",
      role: "admin" as const
    }
  };

  it("delegates overview, dashboard, and security report with the authenticated user", () => {
    const service = {
      getOverview: vi.fn().mockReturnValue({ dashboard: { cards: [] } }),
      getDashboard: vi.fn().mockReturnValue({ cards: [] }),
      getSecurityReport: vi.fn().mockReturnValue({ totalEvents: 0 })
    } as unknown as PlatformService;
    const controller = new PlatformController(service);

    expect(controller.getOverview(request)).toEqual({ dashboard: { cards: [] } });
    expect(controller.getDashboard(request, "sales", "IP-Guard", "feishu")).toEqual({ cards: [] });
    expect(controller.getSecurityReport(request)).toEqual({ totalEvents: 0 });
    expect(service.getOverview).toHaveBeenCalledWith(request.user);
    expect(service.getDashboard).toHaveBeenCalledWith(
      { department: "sales", product: "IP-Guard", channel: "feishu" },
      request.user
    );
    expect(service.getSecurityReport).toHaveBeenCalledWith(request.user);
  });

  it("validates channel messages before routing", () => {
    const service = {
      routeMessage: vi.fn()
    } as unknown as PlatformService;
    const controller = new PlatformController(service);

    expect(() =>
      controller.routeMessage(request, {
        channel: "feishu",
        externalUserId: "ou_1",
        text: " ",
        sourceRef: "msg-1"
      })
    ).toThrow(BadRequestException);
    expect(service.routeMessage).not.toHaveBeenCalled();

    controller.routeMessage(request, {
      channel: "feishu",
      externalUserId: "ou_1",
      text: "查知识库",
      sourceRef: "msg-1"
    });

    expect(service.routeMessage).toHaveBeenCalledWith(
      {
        channel: "feishu",
        externalUserId: "ou_1",
        text: "查知识库",
        sourceRef: "msg-1"
      },
      request.user
    );
  });

  it("validates Skill import, workflow run, product registration, and CIP signal requests", () => {
    const service = {
      importSkill: vi.fn(),
      approveSkill: vi.fn().mockReturnValue({ skillId: "skill-1", status: "approved" }),
      runWorkflow: vi.fn(),
      registerProduct: vi.fn(),
      detectCipSignals: vi.fn()
    } as unknown as PlatformService;
    const controller = new PlatformController(service);

    expect(() =>
      controller.importSkill(request, {
        name: "",
        description: "desc",
        requestedScopes: [],
        packageManifest: "manifest"
      })
    ).toThrow(BadRequestException);

    expect(() =>
      controller.runWorkflow(request, "workflow-1", {
        input: undefined as unknown as Record<string, unknown>
      })
    ).toThrow(BadRequestException);

    expect(() =>
      controller.registerProduct(request, {
        name: "",
        version: "1.0",
        ownerTeam: "渠道"
      })
    ).toThrow(BadRequestException);

    expect(() =>
      controller.detectCipSignals(request, {
        customerId: "demo",
        customerName: "华信精工",
        evidenceText: ""
      })
    ).toThrow(BadRequestException);

    expect(controller.approveSkill(request, "skill-1")).toEqual({ skillId: "skill-1", status: "approved" });
  });
});
