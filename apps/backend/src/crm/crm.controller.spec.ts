import { HttpException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CrmClientError } from "./crm.errors";
import { CrmController } from "./crm.controller";
import type { CrmClient, CrmCustomerContext } from "./crm.types";

const mockConfig = { clientMode: "mock", baseUrl: "", apiToken: "", timeoutMs: 10000 } as const;
const externalConfig = {
  clientMode: "external",
  baseUrl: "https://demo.sworditsys.com/api/v1",
  apiToken: "test-token",
  timeoutMs: 10000
} as const;

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
    const controller = new CrmController(client, mockConfig);

    await expect(controller.listCustomers()).resolves.toEqual({
      source: "mock",
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
    const controller = new CrmController(client, mockConfig);

    await expect(controller.getCustomer(customerContext.customerId)).resolves.toEqual(customerContext);
    expect(client.getCustomer).toHaveBeenCalledWith(customerContext.customerId);
  });

  it("returns customer context for downstream modules", async () => {
    const client = {
      getCustomerContext: vi.fn().mockResolvedValue(customerContext)
    } as unknown as CrmClient;
    const controller = new CrmController(client, mockConfig);

    await expect(controller.getCustomerContext(customerContext.customerId)).resolves.toEqual(customerContext);
    expect(client.getCustomerContext).toHaveBeenCalledWith(customerContext.customerId);
  });

  it("returns 404 when customer is missing", async () => {
    const client = {
      getCustomer: vi.fn().mockResolvedValue(undefined)
    } as unknown as CrmClient;
    const controller = new CrmController(client, mockConfig);

    await expect(controller.getCustomer("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reports the external client source", async () => {
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

    await expect(new CrmController(client, externalConfig).listCustomers()).resolves.toEqual({
      source: "external",
      customers: [expect.objectContaining({ customerId: customerContext.customerId })]
    });
  });

  it.each([
    ["CRM_AUTHENTICATION_FAILED", 502],
    ["CRM_RESPONSE_INVALID", 502],
    ["CRM_REQUEST_REJECTED", 502],
    ["CRM_RATE_LIMITED", 503],
    ["CRM_UNAVAILABLE", 503]
  ] as const)("maps %s to HTTP %i", async (code, status) => {
    const client = {
      listCustomers: vi.fn().mockRejectedValue(new CrmClientError(code, "sanitized", 500))
    } as unknown as CrmClient;

    try {
      await new CrmController(client, externalConfig).listCustomers();
      expect.unreachable("Expected controller to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(status);
      expect((error as HttpException).getResponse()).toMatchObject({ code });
    }
  });
});
