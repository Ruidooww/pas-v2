import { describe, expect, it } from "vitest";
import { createHelmetOptions } from "./security-headers";

describe("createHelmetOptions", () => {
  it("defines a restrictive content security policy", () => {
    expect(createHelmetOptions().contentSecurityPolicy).toEqual(
      expect.objectContaining({
        directives: expect.objectContaining({
          "default-src": ["'self'"],
          "object-src": ["'none'"],
          "frame-ancestors": ["'none'"],
          "connect-src": ["'self'"]
        })
      })
    );
  });
});
