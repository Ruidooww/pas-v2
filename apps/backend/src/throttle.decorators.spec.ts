import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { AuthController } from "./auth/auth.controller";
import { QaController } from "./qa/qa.controller";

const LIMIT_METADATA = "THROTTLER:LIMITdefault";
const TTL_METADATA = "THROTTLER:TTLdefault";

describe("endpoint throttle metadata", () => {
  it("applies stricter defaults to login and QA", () => {
    expect(readMetadata()).toEqual({ loginLimit: 10, loginTtl: 60_000, qaLimit: 30, qaTtl: 60_000 });
  });
});

function readMetadata(): Record<string, number> {
  return {
    loginLimit: Reflect.getMetadata(LIMIT_METADATA, AuthController.prototype.login),
    loginTtl: Reflect.getMetadata(TTL_METADATA, AuthController.prototype.login),
    qaLimit: Reflect.getMetadata(LIMIT_METADATA, QaController.prototype.ask),
    qaTtl: Reflect.getMetadata(TTL_METADATA, QaController.prototype.ask)
  };
}
