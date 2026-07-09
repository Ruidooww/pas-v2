import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCustomerCache } from "../customer-api";
import { CustomerManagementPage } from "./CustomerManagementPage";
import { WorkbenchPage } from "./WorkbenchPage";

describe("CustomerManagementPage", () => {
  afterEach(() => {
    clearCustomerCache();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("explains the mock customer pool when no customer rows are available", async () => {
    localStorage.setItem("pas.access-token", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ customers: [] })
      })
    );

    render(<CustomerManagementPage />);

    expect(await screen.findByText("暂无客户样例")).toBeInTheDocument();
    expect(screen.getByText("当前使用假数据；真实 CRM API 接好后会自动展示客户池。")).toBeInTheDocument();
  });

  it("shares the customer list request across pages for the same token", async () => {
    localStorage.setItem("pas.access-token", "test-token");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/crm/customers") {
        return Promise.resolve(
          jsonResponse({
            customers: [
              {
                customerId: "customer-1",
                name: "Acme Corp",
                industry: "Manufacturing",
                region: "East",
                accountOwner: "Alice"
              }
            ]
          })
        );
      }
      if (path === "/api/internal/proposals") {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <>
        <CustomerManagementPage />
        <WorkbenchPage mode="proposalTasks" />
      </>
    );

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain("/api/internal/proposals"));

    const customerListCalls = fetchMock.mock.calls.filter(([input]) => String(input) === "/api/crm/customers");
    expect(customerListCalls).toHaveLength(1);
  });
});

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}
