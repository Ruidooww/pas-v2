import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SystemController } from "./system.controller";
import type { SystemOverview } from "./system.types";

describe("SystemController", () => {
  it("allows admins to read the system overview", async () => {
    const controller = new SystemController({
      getOverview: async (): Promise<SystemOverview> => ({
        generatedAt: "2026-07-06T00:00:00.000Z",
        settings: [],
        paths: []
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
});

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
