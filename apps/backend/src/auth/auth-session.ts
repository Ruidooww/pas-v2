import { UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "pas.session";
export const CSRF_COOKIE_NAME = "pas.csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

type CookieWriter = {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: Pick<CookieOptions, "path" | "sameSite" | "secure">): unknown;
};

type AuthRequest = {
  method?: string;
  headers?: {
    authorization?: string;
    cookie?: string;
    [CSRF_HEADER_NAME]?: string;
  };
};

export function writeAuthCookies(response: CookieWriter | undefined, accessToken: string, expiresInSeconds: number): void {
  if (!response) {
    return;
  }

  const baseOptions = {
    sameSite: "lax" as const,
    secure: useSecureCookies(),
    path: "/" as const,
    maxAge: expiresInSeconds * 1000
  };
  response.cookie(SESSION_COOKIE_NAME, accessToken, {
    ...baseOptions,
    httpOnly: true
  });
  response.cookie(CSRF_COOKIE_NAME, createCsrfToken(), {
    ...baseOptions,
    httpOnly: false
  });
}

export function clearAuthCookies(response: CookieWriter): void {
  const options = {
    sameSite: "lax" as const,
    secure: useSecureCookies(),
    path: "/" as const
  };
  response.clearCookie(SESSION_COOKIE_NAME, options);
  response.clearCookie(CSRF_COOKIE_NAME, options);
}

export function resolveAccessToken(request: AuthRequest): string {
  const bearerToken = parseBearerToken(request.headers?.authorization);
  if (bearerToken) {
    return bearerToken;
  }

  const cookies = parseCookies(request.headers?.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    throw new UnauthorizedException("bearer token is required");
  }

  if (isUnsafeMethod(request.method) && cookies[CSRF_COOKIE_NAME] !== request.headers?.[CSRF_HEADER_NAME]) {
    throw new UnauthorizedException("CSRF token is required");
  }

  return sessionToken;
}

function parseBearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) {
      continue;
    }
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
  }
  return cookies;
}

function isUnsafeMethod(method: string | undefined): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());
}

function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

function useSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true";
  }
  return process.env.NODE_ENV === "production";
}
