import { describe, expect, it, vi } from "vitest";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { QaAuditLogService } from "./qa-audit-log.service";
import { LocalQaDraftProvider } from "./qa-draft.provider";
import { QaService } from "./qa.service";

describe("QaService", () => {
  it("returns an answer draft with citations from retrieved chunks", async () => {
    const ragflowClient = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue([
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          title: "IP-Guard 管理手册",
          content: "透明加密可对研发图纸进行自动加密保护。",
          score: 0.91,
          source: "manual.pdf"
        }
      ])
    } as unknown as RagflowClient;
    const auditLog = new QaAuditLogService();
    const service = new QaService(ragflowClient, new LocalQaDraftProvider(), auditLog, {
      datasetId: "qa-v0",
      topK: 3
    });

    await expect(service.ask({ query: "如何保护研发图纸？", userId: "user-1" })).resolves.toEqual({
      questionId: expect.stringMatching(/^qa-/),
      status: "answered",
      answer: expect.stringContaining("需人工审核"),
      citations: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          title: "IP-Guard 管理手册",
          source: "manual.pdf",
          score: 0.91
        }
      ]
    });
    expect(ragflowClient.retrieveKnowledgeChunks).toHaveBeenCalledWith({
      datasetId: "qa-v0",
      query: "如何保护研发图纸？",
      topK: 3
    });
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "qa_answer_generated",
          status: "answered",
          citationCount: 1,
          userId: "user-1"
        })
      ])
    );
  });

  it("exposes optional V1 citation metadata when retrieved chunks include it", async () => {
    const ragflowClient = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue([
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          title: "IP-Guard 管理手册",
          content: "透明加密可对研发图纸进行自动加密保护。",
          score: 0.91,
          source: "manual.pdf",
          page: 7,
          section: "透明加密",
          position: "p7:s2",
          location: "page 7 paragraph 2",
          snippet: "研发图纸透明加密保护"
        }
      ])
    } as unknown as RagflowClient;
    const service = new QaService(ragflowClient, new LocalQaDraftProvider(), new QaAuditLogService(), {
      datasetId: "qa-v0",
      topK: 3
    });

    await expect(service.ask({ query: "如何保护研发图纸？", userId: "user-1" })).resolves.toEqual({
      questionId: expect.stringMatching(/^qa-/),
      status: "answered",
      answer: expect.stringContaining("需人工审核"),
      citations: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          title: "IP-Guard 管理手册",
          source: "manual.pdf",
          score: 0.91,
          page: 7,
          section: "透明加密",
          position: "p7:s2",
          location: "page 7 paragraph 2",
          snippet: "研发图纸透明加密保护"
        }
      ]
    });
  });

  it("returns a no-hit response without fabricated citations", async () => {
    const ragflowClient = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue([])
    } as unknown as RagflowClient;
    const service = new QaService(ragflowClient, new LocalQaDraftProvider(), new QaAuditLogService(), {
      datasetId: "qa-v0",
      topK: 3
    });

    await expect(service.ask({ query: "没有资料的问题" })).resolves.toEqual({
      questionId: expect.stringMatching(/^qa-/),
      status: "no_hit",
      answer: "",
      citations: [],
      failureReason: "NO_RELEVANT_KNOWLEDGE_CHUNKS"
    });
  });

  it("returns a stable error response when RAGFlow retrieval fails", async () => {
    const ragflowClient = {
      retrieveKnowledgeChunks: vi.fn().mockRejectedValue(new Error("Bearer secret-token upstream failed"))
    } as unknown as RagflowClient;
    const service = new QaService(ragflowClient, new LocalQaDraftProvider(), new QaAuditLogService(), {
      datasetId: "qa-v0",
      topK: 3
    });

    await expect(service.ask({ query: "RAGFlow 故障问题" })).resolves.toEqual({
      questionId: expect.stringMatching(/^qa-/),
      status: "error",
      answer: "",
      citations: [],
      error: {
        code: "RAGFLOW_RETRIEVAL_FAILED",
        message: "Knowledge retrieval failed"
      }
    });
  });
});
