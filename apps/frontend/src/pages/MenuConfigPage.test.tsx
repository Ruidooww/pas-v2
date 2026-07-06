import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuConfigPage } from "./MenuConfigPage";
import type { MenuConfiguration } from "../types";

describe("MenuConfigPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("lists fixed first-level menus and selected secondary items", async () => {
    vi.stubGlobal("fetch", vi.fn(mockMenuConfigFetch));

    render(<MenuConfigPage />);

    expect((await screen.findAllByText("客户作战")).length).toBeGreaterThan(0);
    expect(screen.getByText("客户管理")).toBeTruthy();
    expect(screen.getByText("商机推进")).toBeTruthy();
  });

  it("sends a visibility update for a second-level item", async () => {
    const fetchMock = vi.fn(mockMenuConfigFetch);
    vi.stubGlobal("fetch", fetchMock);

    render(<MenuConfigPage />);
    fireEvent.click(await screen.findByRole("switch", { name: "商机推进" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/menu/configuration",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("sends a reset request for the selected first-level menu", async () => {
    const fetchMock = vi.fn(mockMenuConfigFetch);
    vi.stubGlobal("fetch", fetchMock);

    render(<MenuConfigPage />);
    fireEvent.click(await screen.findByRole("button", { name: "恢复本组默认" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/menu/configuration/customers/reset",
      expect.objectContaining({ method: "POST" })
    );
  });
});

function mockMenuConfigFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  if (path === "/api/internal/menu/configuration" && init?.method === "PATCH") {
    return Promise.resolve(jsonResponse(createMenuConfiguration()));
  }
  if (path === "/api/internal/menu/configuration/customers/reset") {
    return Promise.resolve(jsonResponse(createMenuConfiguration()));
  }
  if (path === "/api/internal/menu/configuration") {
    return Promise.resolve(jsonResponse(createMenuConfiguration()));
  }
  return Promise.resolve(jsonResponse({}));
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function createMenuConfiguration(): MenuConfiguration {
  return {
    defaults: [
      {
        key: "workbench",
        label: "工作台",
        icon: "home",
        order: 10,
        children: [
          { key: "overview", label: "总览看板", route: "/workbench/overview", roles: ["sales", "presales", "admin"], order: 10 }
        ]
      },
      {
        key: "customers",
        label: "客户作战",
        icon: "customer",
        order: 20,
        children: [
          { key: "customer_management", label: "客户管理", route: "/customers", roles: ["sales", "presales", "admin"], order: 10 },
          { key: "customer_insights", label: "客户画像", route: "/customers/insights", roles: ["sales", "presales", "admin"], order: 20 },
          { key: "opportunities", label: "商机推进", route: "/business/opportunities", roles: ["sales", "presales", "admin"], order: 30 },
          { key: "meeting_minutes", label: "会议纪要", route: "/business/meetings", roles: ["sales", "presales", "admin"], order: 40 },
          { key: "contracts_after_sales", label: "合同售后", route: "/business/contracts-after-sales", roles: ["presales", "admin"], order: 50 }
        ]
      },
      {
        key: "system",
        label: "系统底座",
        icon: "system",
        order: 60,
        children: [
          { key: "platform_governance", label: "平台治理", route: "/platform/governance", roles: ["admin"], order: 10 }
        ]
      }
    ],
    overrides: []
  };
}
