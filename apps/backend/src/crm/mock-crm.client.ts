import type { CrmConfig } from "./crm.config";
import type { CrmClient, CrmCustomerContext, CrmCustomerSummary } from "./crm.types";

const demoCustomerContexts: CrmCustomerContext[] = [
  {
    customerId: "demo-huaxin-manufacturing",
    name: "华信精工",
    industry: "高端制造",
    region: "华东",
    accountOwner: "售前一组",
    contacts: [
      {
        name: "周明",
        title: "信息化负责人",
        role: "decision_maker"
      },
      {
        name: "林珂",
        title: "终端安全管理员",
        role: "technical_evaluator"
      }
    ],
    opportunities: [
      {
        opportunityId: "opp-hx-2026-dlp",
        name: "终端数据防泄漏与透明加密扩容",
        stage: "proposal",
        estimatedValue: 380000,
        expectedCloseDate: "2026-09-30"
      }
    ],
    purchasedProducts: [
      {
        name: "IP-Guard",
        version: "V4",
        activeSeats: 1200
      }
    ],
    followUps: [
      {
        happenedAt: "2026-06-20",
        owner: "售前一组",
        summary: "客户关注研发图纸外发审计、U 盘管控和离职交接场景。"
      },
      {
        happenedAt: "2026-06-27",
        owner: "售前一组",
        summary: "已确认下一轮方案需突出透明加密、权限分级和审计报表。"
      }
    ]
  }
];

export class CrmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmUnavailableError";
  }
}

export class MockCrmClient implements CrmClient {
  constructor(private readonly config: CrmConfig) {}

  async listCustomers(): Promise<CrmCustomerSummary[]> {
    this.assertMockMode();

    return demoCustomerContexts.map(toSummary);
  }

  async getCustomer(customerId: string): Promise<CrmCustomerContext | undefined> {
    this.assertMockMode();

    return demoCustomerContexts.find((customer) => customer.customerId === customerId);
  }

  async getCustomerContext(customerId: string): Promise<CrmCustomerContext | undefined> {
    return this.getCustomer(customerId);
  }

  private assertMockMode(): void {
    if (this.config.clientMode !== "mock") {
      throw new CrmUnavailableError("External CRM adapter is not configured");
    }
  }
}

function toSummary(customer: CrmCustomerContext): CrmCustomerSummary {
  return {
    customerId: customer.customerId,
    name: customer.name,
    industry: customer.industry,
    region: customer.region,
    accountOwner: customer.accountOwner
  };
}
