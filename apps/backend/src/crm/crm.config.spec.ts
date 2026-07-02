import { describe, expect, it } from "vitest";
import { createCrmConfig } from "./crm.config";

describe("createCrmConfig", () => {
  it("uses mock mode by default", () => {
    expect(createCrmConfig({})).toEqual({
      clientMode: "mock"
    });
  });

  it("supports a reserved external mode without storing CRM credentials", () => {
    expect(
      createCrmConfig({
        CRM_CLIENT_MODE: "external",
        CRM_API_TOKEN: "secret-token"
      })
    ).toEqual({
      clientMode: "external"
    });
  });
});
