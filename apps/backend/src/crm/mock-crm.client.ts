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
  },
  {
    customerId: "demo-rongsheng-finance",
    name: "融盛金服",
    industry: "金融服务",
    region: "华南",
    accountOwner: "金融行业组",
    contacts: [
      {
        name: "陈岚",
        title: "风险合规负责人",
        role: "decision_maker"
      },
      {
        name: "何远",
        title: "安全架构师",
        role: "technical_evaluator"
      }
    ],
    opportunities: [
      {
        opportunityId: "opp-rs-2026-audit",
        name: "敏感数据外发审计与终端管控",
        stage: "discovery",
        estimatedValue: 520000,
        expectedCloseDate: "2026-10-31"
      }
    ],
    purchasedProducts: [],
    followUps: [
      {
        happenedAt: "2026-06-18",
        owner: "金融行业组",
        summary: "客户要求方案覆盖合规审计、权限留痕和分支机构终端统一策略。"
      }
    ]
  },
  {
    customerId: "demo-lanyun-software",
    name: "岚云软件",
    industry: "软件研发",
    region: "华北",
    accountOwner: "软件行业组",
    contacts: [
      {
        name: "王澈",
        title: "研发效能负责人",
        role: "business_user"
      },
      {
        name: "赵宁",
        title: "IT 运维负责人",
        role: "technical_evaluator"
      }
    ],
    opportunities: [
      {
        opportunityId: "opp-ly-2026-source",
        name: "源代码与构建产物防泄漏",
        stage: "proposal",
        estimatedValue: 260000,
        expectedCloseDate: "2026-08-31"
      }
    ],
    purchasedProducts: [
      {
        name: "IP-Guard",
        version: "V3",
        activeSeats: 350
      }
    ],
    followUps: [
      {
        happenedAt: "2026-06-25",
        owner: "软件行业组",
        summary: "客户关注源代码仓库下载、外包人员权限和远程办公终端审计。"
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
