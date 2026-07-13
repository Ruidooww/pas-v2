import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProposalLibraryPage } from "./ProposalLibraryPage";

describe("ProposalLibraryPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/proposals/library");
  });

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

  it("filters generated proposals from the summary metric", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([
      proposal("generated-1", "生成方案 A", "generated"),
      proposal("mock-1", "样例方案 B", "mock")
    ])));

    render(<ProposalLibraryPage />);
    expect(await screen.findByText("样例方案 B")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "查看生成方案明细" }));

    expect(screen.getByText("生成方案 A")).toBeTruthy();
    expect(screen.queryByText("样例方案 B")).toBeNull();
    expect(window.location.search).toBe("?source=generated");
  });
});

function proposal(libraryId: string, title: string, source: "generated" | "mock") {
  return {
    libraryId,
    title,
    customerName: "Acme",
    status: source === "generated" ? "export_ready" : "sample",
    source,
    formats: ["docx"],
    tags: [],
    updatedAt: "2026-07-13T00:00:00.000Z"
  };
}

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response;
}
