import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportJobsPage } from "./ExportJobsPage";

describe("ExportJobsPage", () => {
  it("explains how export jobs appear", async () => {
    localStorage.setItem("pas.access-token", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => []
      })
    );

    render(<ExportJobsPage />);

    expect(await screen.findByText("暂无导出任务")).toBeInTheDocument();
    expect(screen.getByText("从方案生成页发起导出后，会在这里看到 docx / pptx / xlsx 状态。")).toBeInTheDocument();
  });
});
