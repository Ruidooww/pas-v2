import crypto from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedUser, JwtConfig, JwtPayload } from "./auth.types";

export class JwtTokenService {
  constructor(private readonly config: JwtConfig) {}

  sign(user: AuthenticatedUser): string {
    const header = {
      alg: "HS256",
      typ: "JWT"
    };
    const payload: JwtPayload = {
      ...user,
      sub: user.userId,
      exp: Math.floor(Date.now() / 1000) + this.config.expiresInSeconds
    };
    const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
    const signature = signHs256(signingInput, this.config.secret);
    return `${signingInput}.${signature}`;
  }

  verify(token: string): JwtPayload {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new UnauthorizedException("invalid token");
    }

    const signingInput = `${parts[0]}.${parts[1]}`;
    const expectedSignature = signHs256(signingInput, this.config.secret);
    if (!constantTimeEqual(parts[2], expectedSignature)) {
      throw new UnauthorizedException("invalid token");
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JwtPayload;
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("token expired");
    }

    return payload;
  }

  get expiresInSeconds(): number {
    return this.config.expiresInSeconds;
  }
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signHs256(input: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(input).digest("base64url");
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
