import { describe, expect, it, vi } from "vitest";
import type { KnowledgeBlock, KnowledgeDocument } from "../knowledge/knowledge.types";
import { PersistenceSink } from "./persistence-sink";

describe("PersistenceSink", () => {
  it("mirrors and loads knowledge block snapshots", async () => {
    const block = createBlock();
    const upsert = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn().mockResolvedValue([{ data: block }]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        knowledgeBlockSnapshot: {
          upsert,
          findMany
        }
      }
    });

    sink.mirrorKnowledgeBlock(block);

    expect(upsert).toHaveBeenCalledWith({
      where: { blockId: "kb-1" },
      create: {
        blockId: "kb-1",
        ownerUserId: "admin-1",
        status: "published",
        data: block,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      },
      update: {
        ownerUserId: "admin-1",
        status: "published",
        data: block,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }
    });
    await expect(sink.loadKnowledgeBlocks()).resolves.toEqual([block]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
  });

  it("mirrors and loads knowledge document snapshots", async () => {
    const document = createDocument();
    const upsert = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn().mockResolvedValue([{ data: document }]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        knowledgeDocumentSnapshot: {
          upsert,
          findMany
        }
      }
    });

    sink.mirrorKnowledgeDocument(document);

    expect(upsert).toHaveBeenCalledWith({
      where: { documentId: "doc-1" },
      create: {
        documentId: "doc-1",
        ownerUserId: "admin-1",
        parseStatus: "done",
        enabled: true,
        data: document,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      },
      update: {
        ownerUserId: "admin-1",
        parseStatus: "done",
        enabled: true,
        data: document,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }
    });
    await expect(sink.loadKnowledgeDocuments()).resolves.toEqual([document]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
  });
});

function createBlock(): KnowledgeBlock {
  return {
    blockId: "kb-1",
    title: "IP-Guard outbound control",
    product: "IP-Guard",
    scenario: "outbound",
    body: "IP-Guard can audit outbound files.",
    citations: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "Manual",
        source: "manual.pdf",
        score: 0.91
      }
    ],
    tags: ["IP-Guard"],
    source: { type: "ragflow_chunk", referenceId: "chunk-1" },
    status: "published",
    version: 1,
    ownerUserId: "admin-1",
    reviewerUserId: "admin-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    publishedAt: "2026-07-05T00:00:00.000Z"
  };
}

function createDocument(): KnowledgeDocument {
  return {
    documentId: "doc-1",
    title: "IP-Guard Manual",
    product: "IP-Guard",
    materialType: "pdf",
    sourceName: "manual.pdf",
    parseStatus: "done",
    enabled: true,
    chunkCount: 42,
    hitCount: 0,
    badFeedbackCount: 0,
    tags: ["IP-Guard"],
    ownerUserId: "admin-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}
