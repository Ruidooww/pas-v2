import { describe, expect, it } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { JwtTokenService } from "./jwt-token.service";
import type { AuthenticatedUser, JwtConfig } from "./auth.types";

const config: JwtConfig = {
  secret: "test-secret",
  expiresInSeconds: 3600
};

const user: AuthenticatedUser = {
  userId: "user-1",
  username: "alice",
  displayName: "Alice",
  role: "presales",
  active: true
};

describe("JwtTokenService negative paths", () => {
  it("round-trips a valid token", () => {
    const service = new JwtTokenService(config);
    const payload = service.verify(service.sign(user));
    expect(payload.sub).toBe("user-1");
  });

  it("rejects a malformed token with missing segments", () => {
    const service = new JwtTokenService(config);
    expect(() => service.verify("only.two")).toThrow(UnauthorizedException);
    expect(() => service.verify("..")).toThrow(UnauthorizedException);
    expect(() => service.verify("")).toThrow(UnauthorizedException);
  });

  it("rejects a token with a tampered payload", () => {
    const service = new JwtTokenService(config);
    const [header = "", payload = "", signature = ""] = service.sign(user).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...decodeSegment(payload), role: "admin" }),
      "utf8"
    ).toString("base64url");
    expect(() => service.verify(`${header}.${forgedPayload}.${signature}`)).toThrow(
      UnauthorizedException
    );
  });

  it("rejects a token signed with a different secret", () => {
    const service = new JwtTokenService(config);
    const foreign = new JwtTokenService({ ...config, secret: "other-secret" });
    expect(() => service.verify(foreign.sign(user))).toThrow(UnauthorizedException);
  });

  it("rejects an alg-swapped header because signature no longer matches", () => {
    const service = new JwtTokenService(config);
    const [, payload = "", signature = ""] = service.sign(user).split(".");
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf8").toString(
      "base64url"
    );
    expect(() => service.verify(`${noneHeader}.${payload}.${signature}`)).toThrow(
      UnauthorizedException
    );
  });

  it("rejects an expired token", () => {
    const service = new JwtTokenService({ ...config, expiresInSeconds: -10 });
    const verifier = new JwtTokenService(config);
    expect(() => verifier.verify(service.sign(user))).toThrow(UnauthorizedException);
  });
});

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}
