import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envKeys = ["THROTTLE_LOGIN_LIMIT_PER_MINUTE", "THROTTLE_QA_LIMIT_PER_MINUTE"] as const;
const previousEnv = new Map<string, string | undefined>();
const LIMIT_METADATA = "THROTTLER:LIMITdefault";
const TTL_METADATA = "THROTTLER:TTLdefault";

describe("endpoint throttle metadata", () => {
  beforeEach(() => {
    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previous = previousEnv.get(key);
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
    previousEnv.clear();
  });

  it("applies stricter defaults to login and QA", async () => {
    const metadata = await loadMetadata();

    expect(metadata).toEqual({ loginLimit: 10, loginTtl: 60_000, qaLimit: 30, qaTtl: 60_000 });
  });

  it("applies configured endpoint limits", async () => {
    process.env.THROTTLE_LOGIN_LIMIT_PER_MINUTE = "7";
    process.env.THROTTLE_QA_LIMIT_PER_MINUTE = "12";

    const metadata = await loadMetadata();

    expect(metadata).toEqual({ loginLimit: 7, loginTtl: 60_000, qaLimit: 12, qaTtl: 60_000 });
  });
});

async function loadMetadata(): Promise<Record<string, number>> {
  const [{ AuthController }, { QaController }] = await Promise.all([
    import("./auth/auth.controller.js"),
    import("./qa/qa.controller.js")
  ]);

  return {
    loginLimit: Reflect.getMetadata(LIMIT_METADATA, AuthController.prototype.login),
    loginTtl: Reflect.getMetadata(TTL_METADATA, AuthController.prototype.login),
    qaLimit: Reflect.getMetadata(LIMIT_METADATA, QaController.prototype.ask),
    qaTtl: Reflect.getMetadata(TTL_METADATA, QaController.prototype.ask)
  };
}
