import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import { AuthService } from "./auth.service";
import { InternalApiAuthGuard } from "./internal-api-auth.guard";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordHasher } from "./password-hasher";
import { InMemoryUserStore } from "./user-store.service";

describe("InternalApiAuthGuard", () => {
  it("allows public API paths without a token", async () => {
    const { guard } = createGuard();
    const request = { url: "/api/health", headers: {} };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it("allows RAGFlow health checks without a token", async () => {
    const { guard } = createGuard();
    const request = { url: "/api/ragflow/health", headers: {} };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it("rejects internal API paths without a bearer token", async () => {
    const { guard } = createGuard();
    const request = { url: "/api/internal/qa/ask", headers: {} };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects CRM customer context paths without a bearer token", async () => {
    const { guard } = createGuard();
    const request = { url: "/api/crm/customers/demo-huaxin-manufacturing/context", headers: {} };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects RAGFlow search without a bearer token", async () => {
    const { guard } = createGuard();
    const request = { url: "/api/ragflow/search", headers: {} };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches the authenticated user to internal API requests", async () => {
    const { service, guard } = createGuard();
    const admin = await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });
    const login = await service.login({
      username: "admin@example.com",
      password: "admin-secret"
    });
    const request = {
      url: "/api/internal/proposals/generate",
      headers: {
        authorization: `Bearer ${login.accessToken}`
      }
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          userId: admin.userId,
          role: "admin"
        })
      })
    );
  });
});

function createGuard(): { service: AuthService; guard: InternalApiAuthGuard } {
  const service = new AuthService(
    new InMemoryUserStore(),
    new PasswordHasher(),
    new JwtTokenService({
      secret: "test-secret",
      expiresInSeconds: 3600
    }),
    new AuditLogService()
  );
  return {
    service,
    guard: new InternalApiAuthGuard(service)
  };
}

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}
