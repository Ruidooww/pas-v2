import { describe, expect, it, vi } from "vitest";
import { RagflowClient } from "./ragflow.client";
import type { RagflowConfig } from "./ragflow.config";

const baseConfig: RagflowConfig = {
  apiKey: "",
  baseUrl: "http://ragflow.local",
  clientMode: "real",
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
      dataset_ids: ["pas-v0"]
    });
  });

  it("returns no retrieval chunks without network calls when client mode is disabled", async () => {
    const fetcher = vi.fn();
    const client = new RagflowClient({ ...baseConfig, clientMode: "disabled" }, fetcher);

    await expect(client.retrieveKnowledgeChunks({ datasetId: "pas-v0", query: "IP-guard" })).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
