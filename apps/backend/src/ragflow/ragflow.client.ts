import type { KnowledgeChunk } from "./knowledge-chunk";
import type { RagflowConfig } from "./ragflow.config";
import { classifyRagflowError, type RagflowErrorKind } from "./ragflow.errors";

type FetchResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
};

type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>;

type RetrievalOptions = {
  fallbackTuning?: boolean;
};

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
    if (this.config.clientMode === "disabled") {
      return [];
    }

    const query = params.query.trim();
    const topK = params.topK ?? 5;
    const chunks = await this.retrieveWithQuery(params.datasetId, query, topK);
    if (chunks.length > 0 || !this.shouldRetryWithFallback(query)) {
      return chunks;
    }

    return this.retrieveWithQuery(params.datasetId, `${this.config.fallbackQueryPrefix} ${query}`, topK, {
      fallbackTuning: true
    });
  }

  private async retrieveWithQuery(
    datasetId: string,
    query: string,
    topK: number,
    options: RetrievalOptions = {}
  ): Promise<KnowledgeChunk[]> {
    const body: Record<string, unknown> = {
      question: query,
      dataset_ids: [datasetId],
      keyword: this.config.keywordEnabled,
      page: 1,
      page_size: topK
    };

    if (options.fallbackTuning) {
      body.similarity_threshold = 0;
      body.vector_similarity_weight = 0.1;
    }

    const response = await this.fetcher(`${this.config.baseUrl}/api/v1/retrieval`, {
      method: "POST",
      headers: this.createHeaders({ json: true }),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`RAGFlow retrieval failed with HTTP ${response.status}`);
    }

    const payload = response.json ? await response.json() : {};
    return extractChunks(payload).map(mapKnowledgeChunk).filter(isKnowledgeChunk);
  }

  private shouldRetryWithFallback(query: string): boolean {
    const prefix = this.config.fallbackQueryPrefix.trim();
    return Boolean(
      this.config.keywordEnabled && prefix && query && !query.toLowerCase().startsWith(prefix.toLowerCase())
    );
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
  const code = numberValue(root.code);
  if (code !== undefined && code !== 0) {
    return [];
  }

  const data = asRecord(root.data);
  const chunks = Array.isArray(data.chunks) ? data.chunks : [];

  return chunks.filter(isRecord);
}

function mapKnowledgeChunk(chunk: Record<string, unknown>): KnowledgeChunk | undefined {
  const chunkId = stringValue(chunk.id) || stringValue(chunk.chunk_id) || stringValue(chunk.chunkId);
  const documentId = stringValue(chunk.document_id) || stringValue(chunk.documentId);
  const title =
    stringValue(chunk.document_name) ||
    stringValue(chunk.document_keyword) ||
    stringValue(chunk.title) ||
    documentId;

  const knowledgeChunk = {
    chunkId,
    documentId,
    title,
    content: stringValue(chunk.content) || stringValue(chunk.content_with_weight),
    score: numberValue(chunk.similarity) ?? numberValue(chunk.score) ?? Number.NaN,
    source: stringValue(chunk.source) || title
  };
  return isKnowledgeChunk(knowledgeChunk) ? knowledgeChunk : undefined;
}

function isKnowledgeChunk(chunk: KnowledgeChunk | undefined): chunk is KnowledgeChunk {
  return Boolean(
    chunk?.chunkId &&
      chunk.documentId &&
      chunk.title &&
      chunk.content &&
      chunk.source &&
      Number.isFinite(chunk.score)
  );
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
