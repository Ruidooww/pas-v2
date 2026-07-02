import crypto from "node:crypto";
import type { JwtConfig } from "./auth.types";

export function createJwtConfig(): JwtConfig {
  return {
    secret: process.env.JWT_SECRET?.trim() || crypto.randomBytes(32).toString("hex"),
    expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 8)
  };
}
