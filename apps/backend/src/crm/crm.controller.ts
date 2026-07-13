import {
  BadGatewayException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ServiceUnavailableException
} from "@nestjs/common";
import type { CrmConfig } from "./crm.config";
import { CrmClientError } from "./crm.errors";
import { CRM_CLIENT, CRM_CONFIG } from "./crm.tokens";
import type { CrmClient, CrmCustomerContext, CrmCustomerSummary } from "./crm.types";

type CustomerListResponse = {
  source: CrmConfig["clientMode"];
  customers: CrmCustomerSummary[];
};

@Controller("api/crm")
export class CrmController {
  constructor(
    @Inject(CRM_CLIENT) private readonly crmClient: CrmClient,
    @Inject(CRM_CONFIG) private readonly crmConfig: CrmConfig
  ) {}

  @Get("customers")
  async listCustomers(): Promise<CustomerListResponse> {
    return this.execute(async () => ({
      source: this.crmConfig.clientMode,
      customers: await this.crmClient.listCustomers()
    }));
  }

  @Get("customers/:customerId")
  async getCustomer(@Param("customerId") customerId: string): Promise<CrmCustomerContext> {
    const customer = await this.execute(() => this.crmClient.getCustomer(customerId));
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  @Get("customers/:customerId/context")
  async getCustomerContext(@Param("customerId") customerId: string): Promise<CrmCustomerContext> {
    const context = await this.execute(() => this.crmClient.getCustomerContext(customerId));
    if (!context) {
      throw new NotFoundException("Customer not found");
    }

    return context;
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof CrmClientError)) throw error;
      const body = { code: error.code, message: crmPublicMessage(error) };
      if (error.code === "CRM_RATE_LIMITED" || error.code === "CRM_UNAVAILABLE") {
        throw new ServiceUnavailableException(body);
      }
      if (error.code === "CRM_NOT_FOUND") {
        throw new NotFoundException(body);
      }
      throw new BadGatewayException(body);
    }
  }
}

function crmPublicMessage(error: CrmClientError): string {
  if (error.code === "CRM_AUTHENTICATION_FAILED") return "CRM authentication or scope is invalid";
  if (error.code === "CRM_RATE_LIMITED") return "CRM request limit reached";
  if (error.code === "CRM_NOT_FOUND") return "Customer not found";
  if (error.code === "CRM_RESPONSE_INVALID") return "CRM returned an invalid response";
  if (error.code === "CRM_REQUEST_REJECTED") return "CRM rejected the request";
  return "CRM is temporarily unavailable";
}
