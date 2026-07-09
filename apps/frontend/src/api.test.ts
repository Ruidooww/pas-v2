import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, getToken, setToken } from "./api";

describe("api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("uses a credential-safe message for login 401 responses", async () => {
    setToken("stale-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { message: "invalid credentials: user root not found" })));

    await expect(api("/api/auth/login", { method: "POST", body: { username: "root", password: "wrong" } })).rejects.toMatchObject({
      name: "ApiError",
      message: "用户名或密码错误",
      status: 401
    } satisfies Partial<ApiError>);

    expect(getToken()).toBeNull();
  });

  it("keeps the session-expired message for protected 401 responses", async () => {
    setToken("expired-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { message: "bearer token is required" })));

    await expect(api("/api/internal/auth/me")).rejects.toMatchObject({
      name: "ApiError",
      message: "登录已失效，请重新登录",
      status: 401
    } satisfies Partial<ApiError>);

    expect(getToken()).toBeNull();
  });

  it("does not expose server error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(500, { message: "PrismaClientKnownRequestError: passwordHash column missing" }))
    );

    await expect(api("/api/internal/auth/users")).rejects.toMatchObject({
      name: "ApiError",
      message: "服务暂时不可用，请稍后再试",
      status: 500
    } satisfies Partial<ApiError>);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}
