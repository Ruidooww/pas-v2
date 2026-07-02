const TOKEN_KEY = "pas.access-token";

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
    throw new ApiError("登录已失效，请重新登录", 401);
  }
  if (!response.ok) {
    let message = `请求失败 (HTTP ${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (payload.message) {
        message = Array.isArray(payload.message) ? payload.message.join("; ") : payload.message;
      }
    } catch {
      // keep default message
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}
