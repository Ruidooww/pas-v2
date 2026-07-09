import { api, getToken } from "./api";
import type { CrmCustomerSummary } from "./types";

type CustomerListResponse = {
  customers: CrmCustomerSummary[];
};

type CustomerCacheEntry = {
  token: string | null;
  promise: Promise<CrmCustomerSummary[]>;
};

let customerCache: CustomerCacheEntry | null = null;

export function loadCustomers(): Promise<CrmCustomerSummary[]> {
  const token = getToken();
  if (customerCache?.token === token) {
    return customerCache.promise;
  }

  const promise = api<CustomerListResponse>("/api/crm/customers").then((response) => response.customers);
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
