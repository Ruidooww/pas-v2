import { describe, expect, it } from "vitest";
import { ExternalCrmClient } from "./external-crm.client";
import { createCrmClient } from "./crm.module";
import { MockCrmClient } from "./mock-crm.client";

describe("createCrmClient", () => {
  it("creates the dedicated mock client", () => {
    expect(
      createCrmClient({ clientMode: "mock", baseUrl: "", apiToken: "", timeoutMs: 10000 })
    ).toBeInstanceOf(MockCrmClient);
  });

  it("creates the external client without mock fallback", () => {
    expect(
      createCrmClient({
        clientMode: "external",
        baseUrl: "https://demo.sworditsys.com/api/v1",
        apiToken: "test-token",
        timeoutMs: 10000
      })
    ).toBeInstanceOf(ExternalCrmClient);
  });
});
