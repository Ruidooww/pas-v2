import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditController } from "./audit.controller";
import { AuditLogService } from "./audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";

describe("AuditController", () => {
  it("allows admins to query audit events", () => {
    const auditLog = new AuditLogService();
    const controller = new AuditController(auditLog);
    auditLog.record({
      action: "login",
      actorUserId: "user-1",
      objectType: "auth_session",
      objectId: "user-1",
      result: "success"
    });

    expect(controller.list(createUser("admin"))).toEqual([
      expect.objectContaining({
        action: "login",
        result: "success"
      })
    ]);
  });

  it("rejects non-admin audit queries", () => {
    const controller = new AuditController(new AuditLogService());

    expect(() => controller.list(createUser("sales"))).toThrow(ForbiddenException);
  });
});

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    userId: "user-1",
    username: "user@example.com",
    displayName: "Test User",
    role,
    organizationUnitId: role === "sales" ? "org-sales" : role === "technical" ? "org-technical-presales" : "org-company",
    projectGroupIds: []
  };
}
