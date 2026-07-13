import { api, getToken } from "./api";
import type { CrmCustomerSummary } from "./types";

export type CustomerListResult = {
  source: "mock" | "external";
  customers: CrmCustomerSummary[];
};

type CustomerCacheEntry = {
  token: string | null;
  promise: Promise<CustomerListResult>;
};

let customerCache: CustomerCacheEntry | null = null;

export function loadCustomers(): Promise<CustomerListResult> {
  const token = getToken();
  if (customerCache?.token === token) {
    return customerCache.promise;
  }

  const promise = api<CustomerListResult>("/api/crm/customers");
  customerCache = { token, promise };
  void promise.catch(() => {
    if (customerCache?.promise === promise) {
      customerCache = null;
    }
  });
  return promise;
}

export function clearCustomerCache(): void {
  customerCache = null;
}
