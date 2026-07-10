import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import { OrganizationService } from "../organization/organization.service";
import { OrganizationStoreService } from "../organization/organization-store.service";
import { createDefaultOrganizationState } from "../organization/organization.types";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import type { LoginRequest, LoginResponse } from "./auth.types";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordHasher } from "./password-hasher";
import { InMemoryUserStore } from "./user-store.service";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

type CookieResponse = {
  cookies: CookieCall[];
  clearedCookies: CookieCall[];
  cookie(name: string, value: string, options: Record<string, unknown>): CookieResponse;
  clearCookie(name: string, options: Record<string, unknown>): CookieResponse;
};

describe("AuthController", () => {
  it("sets an httpOnly session cookie and a readable csrf cookie on login", async () => {
    const { controller, service } = createController();
    const response = createCookieResponse();
    await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });

    const login = await (
      controller.login as unknown as (body: LoginRequest, response: CookieResponse) => Promise<LoginResponse>
    )(
      {
        username: "admin@example.com",
        password: "admin-secret"
      },
      response
    );

    expect(cookie(response.cookies, "pas.session")).toEqual(
      expect.objectContaining({
        value: login.accessToken,
        options: expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 3_600_000
        })
      })
    );
    expect(cookie(response.cookies, "pas.csrf")).toEqual(
      expect.objectContaining({
        options: expect.objectContaining({
          httpOnly: false,
          sameSite: "lax",
          path: "/",
          maxAge: 3_600_000
        })
      })
    );
    expect(cookie(response.cookies, "pas.csrf")?.value).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });

  it("clears session and csrf cookies on logout", () => {
    const { controller } = createController();
    const response = createCookieResponse();

    expect(typeof (controller as unknown as { logout?: unknown }).logout).toBe("function");
    (controller as unknown as { logout(response: CookieResponse): void }).logout(response);

    expect(response.clearedCookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "pas.session", options: expect.objectContaining({ path: "/" }) }),
        expect.objectContaining({ name: "pas.csrf", options: expect.objectContaining({ path: "/" }) })
      ])
    );
  });

  it("reads the current user from a session cookie", async () => {
    const { controller, service } = createController();
    const admin = await service.bootstrapAdmin({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });
    const login = await service.login({
      username: "admin@example.com",
      password: "admin-secret"
    });

    const me = await (
      controller.me as unknown as (request: { headers: { cookie: string } }) => ReturnType<AuthController["me"]>
    )({
      headers: {
        cookie: `pas.session=${login.accessToken}`
      }
    });

    expect(me).toEqual(
      expect.objectContaining({
        userId: admin.userId,
        username: "admin@example.com",
        role: "admin"
      })
    );
  });
});

function createController(): { controller: AuthController; service: AuthService } {
  const auditLog = new AuditLogService();
  const organizationStore = new OrganizationStoreService();
  organizationStore.seed(createDefaultOrganizationState("2026-07-10T00:00:00.000Z"));
  const service = new AuthService(
    new InMemoryUserStore(),
    new PasswordHasher(),
    new JwtTokenService({
      secret: "test-secret",
      expiresInSeconds: 3600
    }),
    auditLog,
    new OrganizationService(organizationStore, auditLog)
  );
  return {
    service,
    controller: new AuthController(service)
  };
}

function createCookieResponse(): CookieResponse {
  const response: CookieResponse = {
    cookies: [],
    clearedCookies: [],
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, value: "", options });
      return this;
    }
  };
  return response;
}

function cookie(cookies: CookieCall[], name: string): CookieCall | undefined {
  return cookies.find((entry) => entry.name === name);
}
