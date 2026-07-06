import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import { AuthService } from "./auth.service";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordHasher } from "./password-hasher";
import { InMemoryUserStore } from "./user-store.service";

describe("AuthService", () => {
  it("lets an admin create a user and lets that user login with a JWT", async () => {
    const { service, auditLog } = createAuthService();
    const admin = await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });

    const created = await service.createUser(admin, {
      username: "presales@example.com",
      password: "user-secret",
      displayName: "Presales User",
      role: "presales"
    });
    const login = await service.login({
      username: "presales@example.com",
      password: "user-secret"
    });
    const me = await service.getMe(login.accessToken);

    expect(created).toEqual(
      expect.objectContaining({
        username: "presales@example.com",
        role: "presales",
        active: true
      })
    );
    expect(login.accessToken.split(".")).toHaveLength(3);
    expect(me).toEqual(
      expect.objectContaining({
        userId: created.userId,
        username: "presales@example.com",
        role: "presales"
      })
    );
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "user_created",
          actorUserId: admin.userId,
          objectId: created.userId,
          result: "success"
        }),
        expect.objectContaining({
          action: "login",
          actorUserId: created.userId,
          result: "success"
        })
      ])
    );
  });

  it("rejects non-admin account creation with a stable error and audit event", async () => {
    const { service, auditLog } = createAuthService();
    const admin = await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });
    const sales = await service.createUser(admin, {
      username: "sales@example.com",
      password: "sales-secret",
      displayName: "Sales User",
      role: "sales"
    });

    await expect(
      service.createUser(sales, {
        username: "blocked@example.com",
        password: "blocked-secret",
        displayName: "Blocked User",
        role: "presales"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "user_created",
          actorUserId: sales.userId,
          result: "failure",
          failureReason: "INSUFFICIENT_ROLE"
        })
      ])
    );
  });

  it("lets an admin list and update users", async () => {
    const { service, auditLog } = createAuthService();
    const admin = await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });
    const sales = await service.createUser(admin, {
      username: "sales@example.com",
      password: "sales-secret",
      displayName: "Sales User",
      role: "sales"
    });

    const updated = service.updateUser(admin, sales.userId, {
      displayName: "Sales Lead",
      role: "presales",
      active: false
    });

    expect(updated).toEqual(
      expect.objectContaining({
        userId: sales.userId,
        displayName: "Sales Lead",
        role: "presales",
        active: false
      })
    );
    expect(service.listUsers(admin).map((user) => user.username)).toEqual(["admin@example.com", "sales@example.com"]);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "user_updated",
          actorUserId: admin.userId,
          objectId: sales.userId,
          result: "success"
        })
      ])
    );
  });

  it("rejects non-admin user listing and updates", async () => {
    const { service, auditLog } = createAuthService();
    const admin = await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });
    const sales = await service.createUser(admin, {
      username: "sales@example.com",
      password: "sales-secret",
      displayName: "Sales User",
      role: "sales"
    });

    expect(() => service.listUsers(sales)).toThrow(ForbiddenException);
    expect(() => service.updateUser(sales, admin.userId, { active: false })).toThrow(ForbiddenException);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "user_updated",
          actorUserId: sales.userId,
          result: "failure",
          failureReason: "INSUFFICIENT_ROLE"
        })
      ])
    );
  });

  it("keeps at least one active admin account", async () => {
    const { service } = createAuthService();
    const admin = await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });

    expect(() => service.updateUser(admin, admin.userId, { active: false })).toThrow("at least one active admin");
    expect(() => service.updateUser(admin, admin.userId, { role: "sales" })).toThrow("at least one active admin");
  });

  it("rejects invalid login credentials", async () => {
    const { service, auditLog } = createAuthService();
    await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });

    await expect(
      service.login({
        username: "admin@example.com",
        password: "wrong-password"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "login",
          objectId: "admin@example.com",
          result: "failure",
          failureReason: "INVALID_CREDENTIALS"
        })
      ])
    );
  });
});

function createAuthService(): { service: AuthService; auditLog: AuditLogService } {
  const auditLog = new AuditLogService();
  const service = new AuthService(
    new InMemoryUserStore(),
    new PasswordHasher(),
    new JwtTokenService({
      secret: "test-secret",
      expiresInSeconds: 3600
    }),
    auditLog
  );
  return { service, auditLog };
}
