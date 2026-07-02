import { describe, expect, it, vi } from "vitest";
import { bootstrapConfiguredAdmin } from "./auth.bootstrap";
import type { AuthService } from "./auth.service";

describe("bootstrapConfiguredAdmin", () => {
  it("does nothing when bootstrap credentials are not configured", async () => {
    const authService = {
      bootstrapAdmin: vi.fn()
    } as unknown as AuthService;

    await bootstrapConfiguredAdmin(authService, {});

    expect(authService.bootstrapAdmin).not.toHaveBeenCalled();
  });

  it("creates a bootstrap admin from environment variables without hardcoded secrets", async () => {
    const authService = {
      bootstrapAdmin: vi.fn().mockResolvedValue(undefined)
    } as unknown as AuthService;

    await bootstrapConfiguredAdmin(authService, {
      AUTH_BOOTSTRAP_ADMIN_USERNAME: "admin@example.com",
      AUTH_BOOTSTRAP_ADMIN_PASSWORD: "admin-secret",
      AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME: "V0 Admin"
    });

    expect(authService.bootstrapAdmin).toHaveBeenCalledWith({
      username: "admin@example.com",
      password: "admin-secret",
      displayName: "V0 Admin"
    });
  });
});
