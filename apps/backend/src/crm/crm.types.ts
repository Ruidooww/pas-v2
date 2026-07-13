export type CrmCustomerSummary = {
  customerId: string;
  name: string;
  industry: string;
  region: string;
  accountOwner: string;
};

export type CrmContact = {
  name: string;
  title: string;
  role: "decision_maker" | "technical_evaluator" | "business_user";
};

export type CrmOpportunity = {
  opportunityId: string;
  name: string;
  stage: "discovery" | "proposal" | "negotiation" | "won";
  estimatedValue: number;
  expectedCloseDate: string;
};

export type CrmPurchasedProduct = {
  name: string;
  version: string;
  activeSeats: number;
};

export type CrmFollowUp = {
  happenedAt: string;
  owner: string;
  summary: string;
};

export type CrmCustomerContext = CrmCustomerSummary & {
  contacts: CrmContact[];
  opportunities: CrmOpportunity[];
  purchasedProducts: CrmPurchasedProduct[];
  followUps: CrmFollowUp[];
};

export type CrmClient = {
  checkHealth(): Promise<void>;
  listCustomers(): Promise<CrmCustomerSummary[]>;
  getCustomer(customerId: string): Promise<CrmCustomerContext | undefined>;
  getCustomerContext(customerId: string): Promise<CrmCustomerContext | undefined>;
};
