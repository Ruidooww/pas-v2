import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { CRM_CLIENT } from "./crm.tokens";
import type { CrmClient, CrmCustomerContext, CrmCustomerSummary } from "./crm.types";

type CustomerListResponse = {
  customers: CrmCustomerSummary[];
};

@Controller("api/crm")
export class CrmController {
  constructor(@Inject(CRM_CLIENT) private readonly crmClient: CrmClient) {}

  @Get("customers")
  async listCustomers(): Promise<CustomerListResponse> {
    return {
      customers: await this.crmClient.listCustomers()
    };
  }

  @Get("customers/:customerId")
  async getCustomer(@Param("customerId") customerId: string): Promise<CrmCustomerContext> {
    const customer = await this.crmClient.getCustomer(customerId);
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  @Get("customers/:customerId/context")
  async getCustomerContext(@Param("customerId") customerId: string): Promise<CrmCustomerContext> {
    const context = await this.crmClient.getCustomerContext(customerId);
    if (!context) {
      throw new NotFoundException("Customer not found");
    }

    return context;
  }
}
