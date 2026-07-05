import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeBlocksPage } from "./KnowledgeBlocksPage";

describe("KnowledgeBlocksPage", () => {
  beforeEach(() => {
    localStorage.setItem("pas.access-token", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            blockId: "kb-1",
            title: "IP-Guard outbound control",
            product: "IP-Guard",
            scenario: "outbound",
            body: "IP-Guard can audit outbound files.",
            citations: [
              {
                chunkId: "chunk-1",
                documentId: "doc-1",
                title: "IP-Guard manual",
                source: "manual.pdf",
                score: 0.91,
                page: 7,
                section: "Outbound control",
                snippet: "Outbound file control evidence"
              }
            ],
            tags: ["IP-Guard", "outbound"],
            source: { type: "ragflow_chunk", referenceId: "chunk-1" },
            status: "published",
            version: 1,
            ownerUserId: "admin-1",
            reviewerUserId: "admin-1",
            createdAt: "2026-07-05T00:00:00.000Z",
            updatedAt: "2026-07-05T00:00:00.000Z",
            publishedAt: "2026-07-05T00:00:00.000Z"
          }
        ]
      })
    );
  });

  it("loads knowledge blocks and shows citation metadata", async () => {
    render(<KnowledgeBlocksPage />);

    expect(await screen.findByText("IP-Guard outbound control")).toBeInTheDocument();
    expect(screen.getByText("IP-Guard")).toBeInTheDocument();
    expect(screen.getByText("published")).toBeInTheDocument();
    expect(screen.getByText(/manual\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/p\.7/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/internal/knowledge-blocks",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    );
  });
});
