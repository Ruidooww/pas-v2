import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AiModelController } from "./ai-model.controller";
import { AiModelError } from "./ai-model.errors";
import type { AiModelCandidateRequest, AiModelOverview, RagflowModelOverview } from "./ai-model.types";

describe("AiModelController", () => {
  it("allows admins to read both non-secret overviews", async () => {
    const service = createService();
    const controller = new AiModelController(service as never);

    expect(controller.getOverview(adminUser())).toEqual(expect.objectContaining({ generation: expect.any(Object) }));
    await expect(controller.getRagflowOverview(adminUser())).resolves.toEqual(expect.objectContaining({ status: "disabled" }));
  });

  it("rejects every management endpoint for non-admin users", () => {
    const controller = new AiModelController(createService() as never);
    const request = requestFor(salesUser(), true, "10.0.0.8");

    expect(() => controller.getOverview(salesUser())).toThrow(ForbiddenException);
    expect(() => controller.getRagflowOverview(salesUser())).toThrow(ForbiddenException);
    expect(() => controller.testGeneration(request, candidate())).toThrow(ForbiddenException);
    expect(() => controller.saveGeneration(request, candidate())).toThrow(ForbiddenException);
    expect(() => controller.disableGeneration(request)).toThrow(ForbiddenException);
  });

  it("allows HTTPS writes", async () => {
    const service = createService();
    const controller = new AiModelController(service as never);
    const request = requestFor(adminUser(), true, "10.0.0.8");

    await controller.testGeneration(request, candidate());
    await controller.saveGeneration(request, { ...candidate(), apiKey: "secret" });
    await controller.disableGeneration(request);

    expect(service.testGeneration).toHaveBeenCalledWith("admin-1", candidate());
    expect(service.saveGeneration).toHaveBeenCalledWith("admin-1", { ...candidate(), apiKey: "secret" });
    expect(service.disableGeneration).toHaveBeenCalledWith("admin-1");
  });

  it("allows loopback HTTP prechecks but rejects LAN HTTP writes", async () => {
    const controller = new AiModelController(createService() as never);

    await expect(controller.testGeneration(requestFor(adminUser(), false, "127.0.0.1"), candidate())).resolves.toEqual(
      expect.objectContaining({ ok: true })
    );
    expect(() => controller.testGeneration(requestFor(adminUser(), false, "10.0.0.8"), candidate())).toThrow(
      ForbiddenException
    );
  });

  it("maps stable model errors to structured bad requests", async () => {
    const service = createService();
    service.saveGeneration.mockRejectedValue(new AiModelError("MODEL_API_KEY_REQUIRED", "key required"));
    const controller = new AiModelController(service as never);

    const error = await captureError(() =>
      controller.saveGeneration(requestFor(adminUser(), true, "10.0.0.8"), candidate())
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: "MODEL_API_KEY_REQUIRED" })
    );
  });
});

function createService() {
  const overview: AiModelOverview = {
    providers: [],
    generation: { status: "not_configured", source: "mock", keyConfigured: false, timeoutSeconds: 30 }
  };
  const ragflow: RagflowModelOverview = {
    status: "disabled",
    baseUrl: "http://ragflow.local",
    unavailableFields: [],
    refreshedAt: "2026-07-11T00:00:00.000Z"
  };
  return {
    getOverview: vi.fn().mockReturnValue(overview),
    testGeneration: vi.fn().mockResolvedValue({ ok: true, provider: "bailian", model: "qwen-plus", elapsedMs: 1 }),
    saveGeneration: vi.fn().mockResolvedValue(overview),
    disableGeneration: vi.fn().mockResolvedValue(overview),
    getRagflowOverview: vi.fn().mockResolvedValue(ragflow)
  };
}

function candidate(): AiModelCandidateRequest {
  return {
    provider: "bailian",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    timeoutSeconds: 30
  };
}

function requestFor(user: AuthenticatedUser, secure: boolean, ip: string) {
  return { user, secure, protocol: secure ? "https" : "http", ip, headers: {} };
}

function adminUser(): AuthenticatedUser {
  return {
    userId: "admin-1",
    username: "admin",
    displayName: "Admin",
    role: "admin",
    organizationUnitId: "org-company",
    projectGroupIds: []
  };
}

function salesUser(): AuthenticatedUser {
  return { ...adminUser(), userId: "sales-1", username: "sales", displayName: "Sales", role: "sales", organizationUnitId: "org-sales" };
}

async function captureError(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
    throw new Error("Expected action to reject");
  } catch (error) {
    return error;
  }
}
