import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("shows the login page when no token is stored", async () => {
    localStorage.clear();
    render(<App />);

    expect(await screen.findByRole("heading", { name: /PAS/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /登\s*录/ })).toBeTruthy();
  });

  it("shows the V2 business flow console for an authenticated user", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === "/api/me") {
          return jsonResponse({
            userId: "admin-1",
            username: "admin@example.com",
            displayName: "Admin",
            role: "admin",
            active: true
          });
        }
        if (path === "/api/crm/customers") {
          return jsonResponse({ customers: [] });
        }
        if (path === "/api/internal/business-flows/records") {
          return jsonResponse({ records: [] });
        }
        if (path === "/api/internal/business-flows/metrics") {
          return jsonResponse({ definitions: [], counters: [] });
        }
        return jsonResponse({});
      })
    );

    render(<App />);

    const menuItem = await screen.findByText("V2 业务闭环");
    fireEvent.click(menuItem);

    expect(await screen.findByRole("heading", { name: "V2 业务闭环" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "商机" })).toBeTruthy();
  });
});

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}
