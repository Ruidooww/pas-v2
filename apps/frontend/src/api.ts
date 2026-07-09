const TOKEN_KEY = "pas.access-token";
const LOGIN_PATH = "/api/auth/login";
const CSRF_COOKIE_NAME = "pas.csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const NETWORK_ERROR_MESSAGE = "网络连接异常，请稍后再试";
const REQUEST_TIMEOUT_MESSAGE = "请求超时，请稍后再试";
const REQUEST_TIMEOUT_MS = 30000;
const SESSION_EXPIRED_MESSAGE = "登录已失效，请重新登录";
const LOGIN_FAILED_MESSAGE = "用户名或密码错误";
const SERVER_ERROR_MESSAGE = "服务暂时不可用，请稍后再试";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const method = options.method ?? "GET";
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const csrfToken = method === "GET" ? null : getCookie(CSRF_COOKIE_NAME);
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  const response = await fetchWithTimeout(path, {
    method,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (response.status === 401) {
    clearToken();
    throw new ApiError(path === LOGIN_PATH ? LOGIN_FAILED_MESSAGE : SESSION_EXPIRED_MESSAGE, 401);
  }
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

async function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(path, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ApiError(REQUEST_TIMEOUT_MESSAGE, 0);
    }
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  if (response.status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  let message = `请求失败 (HTTP ${response.status})`;
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (payload.message) {
      message = Array.isArray(payload.message) ? payload.message.join("; ") : payload.message;
    }
  } catch {
    // keep default message
  }
  return message;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const cookie = part.trim();
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length));
    }
  }
  return null;
}
