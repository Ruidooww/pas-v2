import crypto from "node:crypto";
import type { JwtConfig } from "./auth.types";

type JwtEnv = Partial<Pick<NodeJS.ProcessEnv, "JWT_SECRET" | "JWT_EXPIRES_IN_SECONDS" | "NODE_ENV">>;

export function createJwtConfig(env: JwtEnv = process.env): JwtConfig {
  const secret = env.JWT_SECRET?.trim();
  if (!secret && env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required when NODE_ENV=production");
  }

  return {
    secret: secret || crypto.randomBytes(32).toString("hex"),
    expiresInSeconds: Number(env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 8)
  };
}
