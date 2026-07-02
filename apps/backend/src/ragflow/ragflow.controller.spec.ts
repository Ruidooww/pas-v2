import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RagflowController } from "./ragflow.controller";
import type { RagflowClient } from "./ragflow.client";

describe("RagflowController", () => {
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
    const controller = new RagflowController(client, {
      pasKbId: "pas-v0"
    });

    await expect(controller.search({ query: "  " })).rejects.toBeInstanceOf(BadRequestException);
    expect(client.retrieveKnowledgeChunks).not.toHaveBeenCalled();
  });

  it("rejects search when PAS_KB_ID is not configured", async () => {
    const client = {
      retrieveKnowledgeChunks: vi.fn()
    } as unknown as RagflowClient;
    const controller = new RagflowController(client, {
      pasKbId: ""
    });

    await expect(controller.search({ query: "IP-guard" })).rejects.toBeInstanceOf(BadRequestException);
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
    const controller = new RagflowController(client, {
      pasKbId: "pas-v0"
    });

    await expect(controller.search({ query: "IP-guard" })).resolves.toEqual({
      chunks
    });
    expect(client.retrieveKnowledgeChunks).toHaveBeenCalledWith({
      datasetId: "pas-v0",
      query: "IP-guard",
      topK: undefined
    });
  });
});
