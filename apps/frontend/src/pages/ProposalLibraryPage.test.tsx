import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalLibraryPage } from "./ProposalLibraryPage";

describe("ProposalLibraryPage", () => {
  it("explains how proposal library entries are created", async () => {
    localStorage.setItem("pas.access-token", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => []
      })
    );

    render(<ProposalLibraryPage />);

    expect(await screen.findByText("暂无方案条目")).toBeInTheDocument();
    expect(screen.getByText("在“方案生成”完成客户方案后，会自动进入方案库复用。")).toBeInTheDocument();
    expect(screen.queryByText("生成 + 样例")).toBeNull();
    expect(screen.queryByText("内置样例")).toBeNull();
  });
});
