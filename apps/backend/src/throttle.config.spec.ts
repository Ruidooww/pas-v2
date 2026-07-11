import { describe, expect, it } from "vitest";
import { createThrottleConfig } from "./throttle.config";

describe("createThrottleConfig", () => {
  it("uses safe request-protection defaults", () => {
    expect(createThrottleConfig({})).toEqual({
      ttlMs: 60_000,
      globalLimit: 120,
      loginLimit: 10,
      qaLimit: 30,
      modelTestLimit: 5,
      trustProxyHops: 0
    });
  });

  it("accepts positive integer limits and a non-negative proxy hop count", () => {
    expect(
      createThrottleConfig({
        THROTTLE_LIMIT_PER_MINUTE: "240",
        THROTTLE_LOGIN_LIMIT_PER_MINUTE: "8",
        THROTTLE_QA_LIMIT_PER_MINUTE: "45",
        THROTTLE_MODEL_TEST_LIMIT_PER_MINUTE: "4",
        TRUST_PROXY_HOPS: "2"
      })
    ).toEqual({
      ttlMs: 60_000,
      globalLimit: 240,
      loginLimit: 8,
      qaLimit: 45,
      modelTestLimit: 4,
      trustProxyHops: 2
    });
  });

  it("falls back when numeric values are invalid", () => {
    expect(
      createThrottleConfig({
        THROTTLE_LIMIT_PER_MINUTE: "0",
        THROTTLE_LOGIN_LIMIT_PER_MINUTE: "-1",
        THROTTLE_QA_LIMIT_PER_MINUTE: "1.5",
        THROTTLE_MODEL_TEST_LIMIT_PER_MINUTE: "0",
        TRUST_PROXY_HOPS: "-1"
      })
    ).toEqual({
      ttlMs: 60_000,
      globalLimit: 120,
      loginLimit: 10,
      qaLimit: 30,
      modelTestLimit: 5,
      trustProxyHops: 0
    });
  });
});
