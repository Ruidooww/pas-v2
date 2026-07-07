import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerManagementPage } from "./CustomerManagementPage";

describe("CustomerManagementPage", () => {
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
});
