const TOKEN_KEY = "pas.access-token";
const LOGIN_PATH = "/api/auth/login";
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
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
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
