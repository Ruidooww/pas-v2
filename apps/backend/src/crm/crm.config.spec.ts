import { describe, expect, it } from "vitest";
import { createCrmConfig } from "./crm.config";

describe("createCrmConfig", () => {
  it("uses safe mock defaults", () => {
    expect(createCrmConfig({})).toEqual({
      clientMode: "mock",
      baseUrl: "",
      apiToken: "",
      timeoutMs: 10000
    });
  });

  it("loads the approved external CRM configuration", () => {
    expect(
      createCrmConfig({
        CRM_CLIENT_MODE: "external",
        CRM_BASE_URL: "https://demo.sworditsys.com/api/v1/",
        CRM_API_TOKEN: "test-token",
        CRM_TIMEOUT_MS: "12000"
      })
    ).toEqual({
      clientMode: "external",
      baseUrl: "https://demo.sworditsys.com/api/v1",
      apiToken: "test-token",
      timeoutMs: 12000
    });
  });

  it.each([
    [{ CRM_CLIENT_MODE: "external", CRM_API_TOKEN: "test-token" }, "CRM_BASE_URL"],
    [
      {
        CRM_CLIENT_MODE: "external",
        CRM_BASE_URL: "https://demo.sworditsys.com/api/v1",
        CRM_API_TOKEN: ""
      },
      "CRM_API_TOKEN"
    ],
    [
      {
        CRM_CLIENT_MODE: "external",
        CRM_BASE_URL: "http://demo.sworditsys.com/api/v1",
        CRM_API_TOKEN: "test-token"
      },
      "CRM_BASE_URL"
    ],
    [
      {
        CRM_CLIENT_MODE: "external",
        CRM_BASE_URL: "https://example.com/api/v1",
        CRM_API_TOKEN: "test-token"
      },
      "CRM_BASE_URL"
    ],
    [
      {
        CRM_CLIENT_MODE: "external",
        CRM_BASE_URL: "https://demo.sworditsys.com/api/v1?redirect=x",
        CRM_API_TOKEN: "test-token"
      },
      "CRM_BASE_URL"
    ],
    [
      {
        CRM_CLIENT_MODE: "external",
        CRM_BASE_URL: "https://demo.sworditsys.com/api/v1",
        CRM_API_TOKEN: "test-token",
        CRM_TIMEOUT_MS: "999"
      },
      "CRM_TIMEOUT_MS"
    ]
  ])("rejects invalid external configuration %#", (env, expectedField) => {
    expect(() => createCrmConfig(env)).toThrow(expectedField);
  });
});
