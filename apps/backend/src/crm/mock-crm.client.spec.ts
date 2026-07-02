import { describe, expect, it } from "vitest";
import { CrmUnavailableError, MockCrmClient } from "./mock-crm.client";

describe("MockCrmClient", () => {
  it("lists V0 demo customer summaries", async () => {
    const client = new MockCrmClient({ clientMode: "mock" });

    const customers = await client.listCustomers();

    expect(customers).toEqual([
      expect.objectContaining({
        customerId: "demo-huaxin-manufacturing",
        name: "华信精工",
        industry: "高端制造"
      })
    ]);
  });

  it("returns a reusable customer context", async () => {
    const client = new MockCrmClient({ clientMode: "mock" });

    const detail = await client.getCustomer("demo-huaxin-manufacturing");
    const context = await client.getCustomerContext("demo-huaxin-manufacturing");

    expect(context).toEqual(detail);
    expect(context).toEqual(
      expect.objectContaining({
        contacts: expect.arrayContaining([
          expect.objectContaining({
            role: "decision_maker"
          })
        ]),
        opportunities: expect.arrayContaining([
          expect.objectContaining({
            stage: "proposal"
          })
        ]),
        purchasedProducts: expect.arrayContaining([
          expect.objectContaining({
            name: "IP-Guard"
          })
        ]),
        followUps: expect.arrayContaining([
          expect.objectContaining({
            owner: expect.any(String)
          })
        ])
      })
    );
  });

  it("returns undefined for unknown customers", async () => {
    const client = new MockCrmClient({ clientMode: "mock" });

    await expect(client.getCustomer("missing")).resolves.toBeUndefined();
  });

  it("fails external mode with a sanitized error", async () => {
    const client = new MockCrmClient({ clientMode: "external" });

    await expect(client.listCustomers()).rejects.toEqual(
      new CrmUnavailableError("External CRM adapter is not configured")
    );
  });
});
