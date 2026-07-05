import { describe, expect, it, vi } from "vitest";
import { RagflowClient } from "./ragflow.client";
import type { RagflowConfig } from "./ragflow.config";

const baseConfig: RagflowConfig = {
  apiKey: "",
  baseUrl: "http://ragflow.local",
  clientMode: "real",
  fallbackQueryPrefix: "IP-Guard",
  keywordEnabled: true,
  pasKbId: "pas-v0",
  qaKbId: "qa-v0"
};

describe("RagflowClient", () => {
  it("does not call RAGFlow when client mode is disabled", async () => {
    const fetcher = vi.fn();
    const client = new RagflowClient({ ...baseConfig, clientMode: "disabled" }, fetcher);

    await expect(client.checkHealth()).resolves.toEqual({
      status: "disabled",
      baseUrl: "http://ragflow.local"
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports ok when RAGFlow datasets endpoint responds with 2xx", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(client.checkHealth()).resolves.toEqual({
      status: "ok",
      baseUrl: "http://ragflow.local"
    });
    expect(fetcher).toHaveBeenCalledWith("http://ragflow.local/api/v1/datasets", expect.any(Object));
  });

  it("sends API key as bearer authorization when configured", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
    const client = new RagflowClient({ ...baseConfig, apiKey: "secret-key" }, fetcher);

    await client.checkHealth();

    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret-key"
    });
  });

  it("classifies RAGFlow health failures", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(client.checkHealth()).resolves.toEqual({
      status: "error",
      baseUrl: "http://ragflow.local",
      errorKind: "auth",
      httpStatus: 401
    });
  });

  it("maps retrieval results to PAS KnowledgeChunk records", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          chunks: [
            {
              id: "chunk-1",
              document_id: "doc-1",
              document_name: "Product Manual",
              content: "IP-guard content",
              similarity: 0.82,
              source: "manual.pdf"
            }
          ]
        }
      })
    });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(client.retrieveKnowledgeChunks({ datasetId: "pas-v0", query: "IP-guard" })).resolves.toEqual([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "Product Manual",
        content: "IP-guard content",
        score: 0.82,
        source: "manual.pdf"
      }
    ]);
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(fetcher).toHaveBeenCalledWith("http://ragflow.local/api/v1/retrieval", expect.any(Object));
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      question: "IP-guard",
      dataset_ids: ["pas-v0"],
      keyword: true
    });
  });

  it("preserves optional V1 citation metadata from RAGFlow chunks", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          chunks: [
            {
              id: "chunk-1",
              document_id: "doc-1",
              document_name: "Product Manual",
              content: "IP-guard content",
              similarity: 0.82,
              source: "manual.pdf",
              page: 7,
              section: "Outbound control",
              position: "p7:s2",
              location: "page 7 paragraph 2",
              snippet: "Outbound file control evidence"
            }
          ]
        }
      })
    });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(client.retrieveKnowledgeChunks({ datasetId: "pas-v0", query: "IP-guard" })).resolves.toEqual([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "Product Manual",
        content: "IP-guard content",
        score: 0.82,
        source: "manual.pdf",
        page: 7,
        section: "Outbound control",
        position: "p7:s2",
        location: "page 7 paragraph 2",
        snippet: "Outbound file control evidence"
      }
    ]);
  });

  it("filters retrieval chunks by explicit allowed document ids", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          chunks: [
            {
              id: "chunk-1",
              document_id: "doc-allowed",
              document_name: "Allowed Manual",
              content: "allowed content",
              similarity: 0.82
            },
            {
              id: "chunk-2",
              document_id: "doc-denied",
              document_name: "Denied Manual",
              content: "denied content",
              similarity: 0.8
            }
          ]
        }
      })
    });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(
      client.retrieveKnowledgeChunks({
        datasetId: "pas-v0",
        query: "IP-guard",
        allowedDocumentIds: ["doc-allowed"]
      })
    ).resolves.toEqual([
      expect.objectContaining({
        chunkId: "chunk-1",
        documentId: "doc-allowed"
      })
    ]);
    await expect(
      client.retrieveKnowledgeChunks({
        datasetId: "pas-v0",
        query: "IP-guard",
        allowedDocumentIds: []
      })
    ).resolves.toEqual([]);
  });

  it("drops retrieval chunks without auditable citation fields", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          chunks: [
            {
              id: "chunk-1",
              document_id: "doc-1",
              document_name: "Product Manual",
              content: "IP-guard content",
              similarity: 0.82
            },
            {
              id: "",
              document_id: "doc-2",
              document_name: "Missing chunk id",
              content: "Incomplete content",
              similarity: 0.75
            },
            {
              id: "chunk-3",
              document_id: "doc-3",
              document_name: "Missing score",
              content: "Incomplete content"
            }
          ]
        }
      })
    });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(client.retrieveKnowledgeChunks({ datasetId: "pas-v0", query: "IP-guard" })).resolves.toEqual([
      expect.objectContaining({
        chunkId: "chunk-1",
        documentId: "doc-1",
        score: 0.82
      })
    ]);
  });

  it("retries retrieval with a keyword fallback when the first result has no chunks", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            chunks: []
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            chunks: [
              {
                id: "chunk-1",
                document_id: "doc-1",
                document_keyword: "Product Whitepaper",
                content: "IP-guard content",
                similarity: 0.2
              }
            ]
          }
        })
      });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(client.retrieveKnowledgeChunks({ datasetId: "pas-v0", query: "OA approval gateway" })).resolves.toEqual([
      expect.objectContaining({
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "Product Whitepaper"
      })
    ]);

    const [, fallbackInit] = fetcher.mock.calls[1] ?? [];
    expect(JSON.parse(String(fallbackInit?.body))).toMatchObject({
      question: "IP-Guard OA approval gateway",
      dataset_ids: ["pas-v0"],
      keyword: true,
      similarity_threshold: 0,
      vector_similarity_weight: 0.1
    });
  });

  it("retries retrieval when RAGFlow returns a non-zero business code", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 100,
          data: null,
          message: "AssertionError()"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            chunks: [
              {
                id: "chunk-1",
                document_id: "doc-1",
                document_keyword: "Product Whitepaper",
                content: "IP-guard content",
                similarity: 0.2
              }
            ]
          }
        })
      });
    const client = new RagflowClient(baseConfig, fetcher);

    await expect(client.retrieveKnowledgeChunks({ datasetId: "pas-v0", query: "risk boundary" })).resolves.toEqual([
      expect.objectContaining({
        chunkId: "chunk-1"
      })
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns no retrieval chunks without network calls when client mode is disabled", async () => {
    const fetcher = vi.fn();
    const client = new RagflowClient({ ...baseConfig, clientMode: "disabled" }, fetcher);

    await expect(client.retrieveKnowledgeChunks({ datasetId: "pas-v0", query: "IP-guard" })).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
