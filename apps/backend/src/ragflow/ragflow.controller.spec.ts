import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeDocumentService } from "../knowledge/knowledge-document.service";
import { RagflowController } from "./ragflow.controller";
import type { RagflowClient } from "./ragflow.client";

describe("RagflowController", () => {
  const request = {
    user: {
      userId: "user-1",
      username: "user-1@example.com",
      displayName: "User 1",
      role: "sales" as const,
      organizationUnitId: "org-sales",
      projectGroupIds: []
    }
  };

  it("delegates health checks to RagflowClient", async () => {
    const client = {
      checkHealth: vi.fn().mockResolvedValue({
        status: "ok",
        baseUrl: "http://ragflow.local"
      })
    } as unknown as RagflowClient;
    const controller = new RagflowController(client, {
      pasKbId: "pas-v0"
    });

    await expect(controller.getHealth()).resolves.toEqual({
      status: "ok",
      baseUrl: "http://ragflow.local"
    });
    expect(client.checkHealth).toHaveBeenCalledOnce();
  });

  it("rejects blank search queries before calling RAGFlow", async () => {
    const client = {
      retrieveKnowledgeChunks: vi.fn()
    } as unknown as RagflowClient;
    const controller = new RagflowController(client, { pasKbId: "pas-v0" }, createDocumentService());

    await expect(controller.search(request, { query: "  " })).rejects.toBeInstanceOf(BadRequestException);
    expect(client.retrieveKnowledgeChunks).not.toHaveBeenCalled();
  });

  it("rejects search when PAS_KB_ID is not configured", async () => {
    const client = {
      retrieveKnowledgeChunks: vi.fn()
    } as unknown as RagflowClient;
    const controller = new RagflowController(client, { pasKbId: "" }, createDocumentService());

    await expect(controller.search(request, { query: "IP-guard" })).rejects.toBeInstanceOf(BadRequestException);
    expect(client.retrieveKnowledgeChunks).not.toHaveBeenCalled();
  });

  it("searches the configured PAS dataset and returns KnowledgeChunk results", async () => {
    const chunks = [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "Manual",
        content: "content",
        score: 0.9,
        source: "manual.pdf"
      }
    ];
    const client = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue(chunks)
    } as unknown as RagflowClient;
    const documents = createDocumentService(["doc-1"]);
    const controller = new RagflowController(client, { pasKbId: "pas-v0" }, documents);

    await expect(controller.search(request, { query: "IP-guard" })).resolves.toEqual({
      chunks
    });
    expect(documents.getAccessibleDocumentIds).toHaveBeenCalledWith(request.user);
    expect(client.retrieveKnowledgeChunks).toHaveBeenCalledWith({
      datasetId: "pas-v0",
      query: "IP-guard",
      topK: undefined,
      allowedDocumentIds: ["doc-1"]
    });
  });

  it("sends an empty allow-list to RAGFlow when the current user has no accessible documents", async () => {
    const client = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue([])
    } as unknown as RagflowClient;
    const controller = new RagflowController(client, { pasKbId: "pas-v0" }, createDocumentService([]));

    await expect(controller.search(request, { query: "IP-guard" })).resolves.toEqual({ chunks: [] });
    expect(client.retrieveKnowledgeChunks).toHaveBeenCalledWith({
      datasetId: "pas-v0",
      query: "IP-guard",
      topK: undefined,
      allowedDocumentIds: []
    });
  });

  it("searches without document ACL filters before the metadata catalog is configured", async () => {
    const client = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue([])
    } as unknown as RagflowClient;
    const documents = createDocumentService([], false);
    const controller = new RagflowController(client, { pasKbId: "pas-v0" }, documents);

    await expect(controller.search(request, { query: "IP-Guard" })).resolves.toEqual({ chunks: [] });
    expect(documents.getAccessibleDocumentIds).not.toHaveBeenCalled();
    expect(client.retrieveKnowledgeChunks).toHaveBeenCalledWith({
      datasetId: "pas-v0",
      query: "IP-Guard",
      topK: undefined
    });
  });
});

function createDocumentService(ids: string[] = ["doc-1"], hasDocuments = true) {
  return {
    hasDocuments: vi.fn().mockReturnValue(hasDocuments),
    getAccessibleDocumentIds: vi.fn().mockReturnValue(ids)
  } as unknown as KnowledgeDocumentService;
}
