import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrefixedId } from "./ids";

describe("createPrefixedId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds IDs from crypto.randomUUID", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-2222-4333-8444-555555555555");

    expect(createPrefixedId("proposal-job")).toBe("proposal-job-11111111-2222-4333-8444-555555555555");
  });
});
