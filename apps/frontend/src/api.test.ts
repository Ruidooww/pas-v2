import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, getToken, setToken } from "./api";

describe("api", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.cookie = "pas.csrf=; Max-Age=0; path=/";
  });

  it("includes browser credentials on API requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await api("/api/me");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("sends the csrf cookie value on unsafe API requests", async () => {
    document.cookie = "pas.csrf=csrf-token; path=/";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await api("/api/internal/auth/users", { method: "POST", body: { username: "admin@example.com" } });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/auth/users",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "x-csrf-token": "csrf-token"
        })
      })
    );
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

  it("uses a safe message for network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch http://internal/api")));

    await expect(api("/api/internal/auth/users")).rejects.toMatchObject({
      name: "ApiError",
      message: "网络连接异常，请稍后再试",
      status: 0
    } satisfies Partial<ApiError>);
  });

  it("aborts requests that exceed the timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(abortError()));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = api("/api/internal/auth/users");
    const assertion = expect(request).rejects.toMatchObject({
      name: "ApiError",
      message: "请求超时，请稍后再试",
      status: 0
    } satisfies Partial<ApiError>);

    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal?.aborted).toBe(true);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}
