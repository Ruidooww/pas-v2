import type { KnowledgeChunk } from "./knowledge-chunk";
import type { RagflowConfig } from "./ragflow.config";
import { classifyRagflowError, type RagflowErrorKind } from "./ragflow.errors";

type FetchResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

export type RagflowHealth =
  | {
      status: "disabled" | "ok";
      baseUrl: string;
    }
  | {
      status: "error";
      baseUrl: string;
      errorKind: RagflowErrorKind;
      httpStatus?: number;
    };

export type RetrieveKnowledgeChunksRequest = {
  datasetId: string;
  query: string;
  topK?: number;
};

export class RagflowClient {
  constructor(
    private readonly config: RagflowConfig,
    private readonly fetcher: Fetcher = fetch
  ) {}

  async checkHealth(): Promise<RagflowHealth> {
    if (this.config.clientMode === "disabled") {
      return {
        status: "disabled",
        baseUrl: this.config.baseUrl
      };
    }

    try {
      const response = await this.fetcher(`${this.config.baseUrl}/api/v1/datasets`, {
        method: "GET",
        headers: this.createHeaders()
      });

      if (response.ok) {
        return {
          status: "ok",
          baseUrl: this.config.baseUrl
        };
      }

      return {
        status: "error",
        baseUrl: this.config.baseUrl,
        errorKind: classifyRagflowError({ status: response.status }),
        httpStatus: response.status
      };
    } catch (error) {
      return {
        status: "error",
        baseUrl: this.config.baseUrl,
        errorKind: classifyRagflowError(error)
      };
    }
  }

  async retrieveKnowledgeChunks(params: RetrieveKnowledgeChunksRequest): Promise<KnowledgeChunk[]> {
    const response = await this.fetcher(`${this.config.baseUrl}/api/v1/retrieval`, {
      method: "POST",
      headers: this.createHeaders({ json: true }),
      body: JSON.stringify({
        question: params.query,
        dataset_ids: [params.datasetId],
        page: 1,
        page_size: params.topK ?? 5
      })
    });

    if (!response.ok) {
      throw new Error(`RAGFlow retrieval failed with HTTP ${response.status}`);
    }

    const payload = response.json ? await response.json() : {};
    return extractChunks(payload).map(mapKnowledgeChunk);
  }

  private createHeaders(options: { json?: boolean } = {}): Record<string, string> {
    const headers: Record<string, string> = {};

    if (options.json) {
      headers["Content-Type"] = "application/json";
    }

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }
}

function extractChunks(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const chunks = Array.isArray(data.chunks) ? data.chunks : [];

  return chunks.filter(isRecord);
}

function mapKnowledgeChunk(chunk: Record<string, unknown>): KnowledgeChunk {
  const chunkId = stringValue(chunk.id) || stringValue(chunk.chunk_id) || stringValue(chunk.chunkId);
  const documentId = stringValue(chunk.document_id) || stringValue(chunk.documentId);
  const title =
    stringValue(chunk.document_name) ||
    stringValue(chunk.document_keyword) ||
    stringValue(chunk.title) ||
    documentId;

  return {
    chunkId,
    documentId,
    title,
    content: stringValue(chunk.content) || stringValue(chunk.content_with_weight),
    score: numberValue(chunk.similarity) ?? numberValue(chunk.score) ?? Number.NaN,
    source: stringValue(chunk.source) || title
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
