import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BusinessFlowsPage } from "./BusinessFlowsPage";
import { FeedbackPage } from "./FeedbackPage";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("operational metric drilldowns", () => {
  it("filters open feedback from the pending metric", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([
      feedback("feedback-open", "open", 2),
      feedback("feedback-resolved", "resolved", 5)
    ])));

    render(<FeedbackPage />);
    expect(await screen.findByText(/feedback-resolved/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "查看待处理明细" }));

    expect(screen.getByText(/feedback-open/)).toBeTruthy();
    expect(screen.queryByText(/feedback-resolved/)).toBeNull();
    expect(window.location.search).toBe("?feedback=open");
  });

  it("filters records with pending inputs from the business metric", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/metrics")) return Promise.resolve(jsonResponse({ definitions: [], counters: [] }));
      return Promise.resolve(jsonResponse({ records: [
        businessRecord("record-pending", ["CRM 阶段"]),
        businessRecord("record-ready", [])
      ] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BusinessFlowsPage />);
    expect(await screen.findByText("record-ready")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "查看待外部输入明细" }));

    expect(screen.getByText("record-pending")).toBeTruthy();
    expect(screen.queryByText("record-ready")).toBeNull();
    expect(window.location.search).toBe("?records=pending_inputs");
  });
});

function feedback(objectId: string, status: "open" | "resolved", rating: 2 | 5) {
  return {
    feedbackId: `id-${objectId}`,
    objectType: "proposal",
    objectId,
    rating,
    issueType: "quality",
    comment: "comment",
    status,
    createdBy: "user-1",
    createdAt: "2026-07-13T00:00:00.000Z"
  };
}

function businessRecord(recordId: string, pendingInputs: string[]) {
  return {
    recordId,
    kind: "opportunity",
    status: pendingInputs.length ? "pending_confirmation" : "completed",
    ownerUserId: "user-1",
    source: { system: "test", reference: recordId, capturedAt: "2026-07-13T00:00:00.000Z" },
    payload: {},
    outputs: {},
    pendingInputs,
    events: [],
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z"
  };
}

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response;
}
