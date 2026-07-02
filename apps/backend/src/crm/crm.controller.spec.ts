import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CrmController } from "./crm.controller";
import type { CrmClient, CrmCustomerContext } from "./crm.types";

const customerContext: CrmCustomerContext = {
  customerId: "demo-huaxin-manufacturing",
  name: "华信精工",
  industry: "高端制造",
  region: "华东",
  accountOwner: "售前一组",
  contacts: [],
  opportunities: [],
  purchasedProducts: [],
  followUps: []
};

describe("CrmController", () => {
  it("lists customers through the CRM client", async () => {
    const client = {
      listCustomers: vi.fn().mockResolvedValue([
        {
          customerId: customerContext.customerId,
          name: customerContext.name,
          industry: customerContext.industry,
          region: customerContext.region,
          accountOwner: customerContext.accountOwner
        }
      ])
    } as unknown as CrmClient;
    const controller = new CrmController(client);

    await expect(controller.listCustomers()).resolves.toEqual({
      customers: [
        {
          customerId: customerContext.customerId,
          name: customerContext.name,
          industry: customerContext.industry,
          region: customerContext.region,
          accountOwner: customerContext.accountOwner
        }
      ]
    });
  });

  it("returns customer detail", async () => {
    const client = {
      getCustomer: vi.fn().mockResolvedValue(customerContext)
    } as unknown as CrmClient;
    const controller = new CrmController(client);

    await expect(controller.getCustomer(customerContext.customerId)).resolves.toEqual(customerContext);
    expect(client.getCustomer).toHaveBeenCalledWith(customerContext.customerId);
  });

  it("returns customer context for downstream modules", async () => {
    const client = {
      getCustomerContext: vi.fn().mockResolvedValue(customerContext)
    } as unknown as CrmClient;
    const controller = new CrmController(client);

    await expect(controller.getCustomerContext(customerContext.customerId)).resolves.toEqual(customerContext);
    expect(client.getCustomerContext).toHaveBeenCalledWith(customerContext.customerId);
  });

  it("returns 404 when customer is missing", async () => {
    const client = {
      getCustomer: vi.fn().mockResolvedValue(undefined)
    } as unknown as CrmClient;
    const controller = new CrmController(client);

    await expect(controller.getCustomer("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
