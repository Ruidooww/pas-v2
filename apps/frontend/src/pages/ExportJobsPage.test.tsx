import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportJobsPage } from "./ExportJobsPage";

describe("ExportJobsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/exports");
  });

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

  it("filters the task list from the completed metric", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([
      exportJob("export-completed", "completed"),
      exportJob("export-failed", "failed")
    ])));

    render(<ExportJobsPage />);
    expect(await screen.findByText("export-failed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "查看完成明细" }));

    expect(screen.getByText("export-completed")).toBeTruthy();
    expect(screen.queryByText("export-failed")).toBeNull();
    expect(window.location.search).toBe("?result=completed");
  });
});

function exportJob(jobId: string, status: "completed" | "failed") {
  return {
    jobId,
    sourcePackageId: `package-${jobId}`,
    customerId: `customer-${jobId}`,
    userId: "user-1",
    status,
    formats: status === "completed"
      ? [{ format: "docx", status: "completed", fileName: `${jobId}.docx`, size: 10 }]
      : [{ format: "docx", status: "failed", errorMessage: "failed" }],
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z"
  };
}

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response;
}
