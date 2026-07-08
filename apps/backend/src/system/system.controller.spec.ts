import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SystemController } from "./system.controller";
import type { LoginBranding, SystemOverview } from "./system.types";

describe("SystemController", () => {
  it("allows admins to read the system overview", async () => {
    const controller = new SystemController({
      getOverview: async (): Promise<SystemOverview> => ({
        generatedAt: "2026-07-06T00:00:00.000Z",
        settings: [],
        paths: [],
        branding: createBranding()
      })
    } as never);

    await expect(controller.getOverview(adminUser())).resolves.toEqual(
      expect.objectContaining({ generatedAt: "2026-07-06T00:00:00.000Z" })
    );
  });

  it("rejects non-admin users", () => {
    const controller = new SystemController({ getOverview: async () => ({ settings: [], paths: [] }) } as never);

    expect(() => controller.getOverview(salesUser())).toThrow(ForbiddenException);
  });

  it("allows anonymous users to read login branding", async () => {
    const controller = new SystemController({
      getLoginBranding: async (): Promise<LoginBranding> => createBranding()
    } as never);

    await expect(controller.getLoginBranding()).resolves.toEqual(
      expect.objectContaining({
        title: "PAS 售前辅助系统"
      })
    );
  });

  it("allows admins to update login branding", async () => {
    const controller = new SystemController({
      updateLoginBranding: async (actorUserId: string, body: Partial<LoginBranding>): Promise<LoginBranding> => ({
        ...createBranding(),
        ...body,
        updatedBy: actorUserId
      })
    } as never);

    await expect(controller.updateLoginBranding(adminUser(), { title: "HYYN" })).resolves.toEqual(
      expect.objectContaining({ title: "HYYN", updatedBy: "admin-1" })
    );
  });
});

function createBranding(): LoginBranding {
  return {
    title: "PAS 售前辅助系统",
    subtitle: "账号由管理员分配，如无账号请联系管理员"
  };
}

function adminUser(): AuthenticatedUser {
  return {
    userId: "admin-1",
    username: "admin",
    displayName: "Admin",
    role: "admin"
  };
}

function salesUser(): AuthenticatedUser {
  return {
    userId: "sales-1",
    username: "sales",
    displayName: "Sales",
    role: "sales"
  };
}
