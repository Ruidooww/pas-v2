import { describe, expect, it } from "vitest";
import { createJwtConfig } from "./auth.config";

describe("createJwtConfig", () => {
  it("uses the configured JWT secret", () => {
    expect(
      createJwtConfig({
        JWT_SECRET: "configured-secret",
        JWT_EXPIRES_IN_SECONDS: "60",
        NODE_ENV: "production"
      })
    ).toEqual({
      secret: "configured-secret",
      expiresInSeconds: 60
    });
  });

  it("creates an ephemeral secret outside production when JWT_SECRET is missing", () => {
    const config = createJwtConfig({
      NODE_ENV: "test"
    });

    expect(config.secret).toHaveLength(64);
    expect(config.expiresInSeconds).toBe(28800);
  });

  it("rejects production config without JWT_SECRET", () => {
    expect(() =>
      createJwtConfig({
        JWT_SECRET: "",
        NODE_ENV: "production"
      })
    ).toThrow("JWT_SECRET is required when NODE_ENV=production");
  });
});
