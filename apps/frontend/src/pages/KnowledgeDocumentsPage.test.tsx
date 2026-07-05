import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeDocumentsPage } from "./KnowledgeDocumentsPage";

describe("KnowledgeDocumentsPage", () => {
  beforeEach(() => {
    localStorage.setItem("pas.access-token", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            documentId: "doc-1",
            title: "IP-Guard Manual",
            product: "IP-Guard",
            materialType: "pdf",
            sourceName: "manual.pdf",
            parseStatus: "done",
            enabled: true,
            chunkCount: 42,
            hitCount: 7,
            badFeedbackCount: 1,
            tags: ["IP-Guard", "manual"],
            ownerUserId: "admin-1",
            createdAt: "2026-07-05T00:00:00.000Z",
            updatedAt: "2026-07-05T00:00:00.000Z"
          }
        ]
      })
    );
  });

  it("loads knowledge documents and shows operations metadata", async () => {
    render(<KnowledgeDocumentsPage />);

    expect(await screen.findByText("IP-Guard Manual")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("42 chunks")).toBeInTheDocument();
    expect(screen.getByText("7 hits")).toBeInTheDocument();
    expect(screen.getByText("1 bad feedback")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/internal/knowledge-documents",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    );
  });
});
