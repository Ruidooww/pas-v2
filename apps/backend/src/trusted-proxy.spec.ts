import { describe, expect, it, vi } from "vitest";
import { configureTrustProxy } from "./trusted-proxy";

describe("configureTrustProxy", () => {
  it("does not trust forwarded headers when hops are zero", () => {
    const set = vi.fn();

    configureTrustProxy({ set }, 0);

    expect(set).not.toHaveBeenCalled();
  });

  it("sets the configured trusted proxy hop count", () => {
    const set = vi.fn();

    configureTrustProxy({ set }, 2);

    expect(set).toHaveBeenCalledWith("trust proxy", 2);
  });
});
