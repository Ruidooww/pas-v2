const THROTTLE_WINDOW_MS = 60_000;

type ThrottleEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "THROTTLE_LIMIT_PER_MINUTE"
    | "THROTTLE_LOGIN_LIMIT_PER_MINUTE"
    | "THROTTLE_QA_LIMIT_PER_MINUTE"
    | "TRUST_PROXY_HOPS"
  >
>;

export type ThrottleConfig = {
  ttlMs: number;
  globalLimit: number;
  loginLimit: number;
  qaLimit: number;
  trustProxyHops: number;
};

export function createThrottleConfig(env: ThrottleEnv = process.env): ThrottleConfig {
  return {
    ttlMs: THROTTLE_WINDOW_MS,
    globalLimit: readInteger(env.THROTTLE_LIMIT_PER_MINUTE, 120, 1),
    loginLimit: readInteger(env.THROTTLE_LOGIN_LIMIT_PER_MINUTE, 10, 1),
    qaLimit: readInteger(env.THROTTLE_QA_LIMIT_PER_MINUTE, 30, 1),
    trustProxyHops: readInteger(env.TRUST_PROXY_HOPS, 0, 0)
  };
}

function readInteger(rawValue: string | undefined, fallback: number, minimum: number): number {
  if (!rawValue?.trim()) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}
