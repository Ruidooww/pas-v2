import { describe, expect, it } from "vitest";
import { createCrmConfig } from "./crm.config";
import { CrmUnavailableError, MockCrmClient } from "./mock-crm.client";

describe("MockCrmClient", () => {
  it("lists V0 demo customer summaries", async () => {
    const client = new MockCrmClient(createCrmConfig({}));

    const customers = await client.listCustomers();

    expect(customers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        customerId: "demo-huaxin-manufacturing",
        name: "华信精工",
        industry: "高端制造"
      })
    ]));
    expect(customers).toHaveLength(3);
    expect(customers.map((customer) => customer.industry)).toEqual(["高端制造", "金融服务", "软件研发"]);
  });

  it("returns a reusable customer context", async () => {
    const client = new MockCrmClient(createCrmConfig({}));

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
    const client = new MockCrmClient(createCrmConfig({}));

    await expect(client.getCustomer("missing")).resolves.toBeUndefined();
  });

  it("fails external mode with a sanitized error", async () => {
    const client = new MockCrmClient(
      createCrmConfig({
        CRM_CLIENT_MODE: "external",
        CRM_BASE_URL: "https://demo.sworditsys.com/api/v1",
        CRM_API_TOKEN: "test-token"
      })
    );

    await expect(client.listCustomers()).rejects.toEqual(
      new CrmUnavailableError("External CRM adapter is not configured")
    );
  });
});
