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
  allowedDocumentIds?: string[];
};

export type RagflowDatasetOverview = {
  datasetId: string;
  name?: string;
  embeddingModel?: string;
  rerankerModel?: string;
  chatModel?: string;
  language?: string;
  chunkMethod?: string;
  documentCount?: number;
  chunkCount?: number;
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
    if (params.allowedDocumentIds && params.allowedDocumentIds.length === 0) {
      return [];
    }

    let chunks: KnowledgeChunk[];
    try {
      chunks = filterAllowedDocuments(
        await this.retrieveWithQuery(params.datasetId, query, topK),
        params.allowedDocumentIds
      );
    } catch (error) {
      if (!this.shouldRetryWithFallback(query)) {
        throw error;
      }
      return filterAllowedDocuments(
        await this.retrieveWithQuery(params.datasetId, `${this.config.fallbackQueryPrefix} ${query}`, topK, {
          fallbackTuning: true
        }),
        params.allowedDocumentIds
      );
    }
    if (chunks.length > 0 || !this.shouldRetryWithFallback(query)) {
      return chunks;
    }

    return filterAllowedDocuments(
      await this.retrieveWithQuery(params.datasetId, `${this.config.fallbackQueryPrefix} ${query}`, topK, {
        fallbackTuning: true
      }),
      params.allowedDocumentIds
    );
  }

  async getDatasetOverview(datasetId: string): Promise<RagflowDatasetOverview | undefined> {
    if (this.config.clientMode === "disabled") {
      return undefined;
    }

    const normalizedDatasetId = datasetId.trim();
    if (!normalizedDatasetId) {
      return undefined;
    }
    const response = await this.fetcher(
      `${this.config.baseUrl}/api/v1/datasets?id=${encodeURIComponent(normalizedDatasetId)}`,
      {
        method: "GET",
        headers: this.createHeaders()
      }
    );
    if (!response.ok) {
      throw new Error(`RAGFlow dataset lookup failed with HTTP ${response.status}`);
    }

    const payload = response.json ? await response.json() : {};
    const dataset = extractDataset(payload, normalizedDatasetId);
    return mapDatasetOverview(dataset, normalizedDatasetId);
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
    const message = stringValue(root.message) || "RAGFlow business error";
    throw new Error(`RAGFlow retrieval rejected with code ${code}: ${message}`);
  }

  const data = asRecord(root.data);
  const chunks = Array.isArray(data.chunks) ? data.chunks : [];

  return chunks.filter(isRecord);
}

function extractDataset(payload: unknown, datasetId: string): Record<string, unknown> {
  const root = asRecord(payload);
  const code = numberValue(root.code);
  if (code !== undefined && code !== 0) {
    throw new Error(`RAGFlow dataset lookup rejected with code ${code}`);
  }

  const data = root.data;
  const dataRecord = asRecord(data);
  const nestedDatasets = dataRecord.datasets;
  const rows = Array.isArray(data)
    ? data.filter(isRecord)
    : Array.isArray(nestedDatasets)
      ? nestedDatasets.filter(isRecord)
      : [];
  return rows.find((row) => stringValue(row.id) === datasetId) ?? rows[0] ?? {};
}

function mapDatasetOverview(dataset: Record<string, unknown>, fallbackId: string): RagflowDatasetOverview {
  const overview: RagflowDatasetOverview = {
    datasetId: stringValue(dataset.id) || fallbackId
  };
  addString(overview, "name", dataset.name);
  addString(overview, "embeddingModel", dataset.embd_id ?? dataset.embedding_model);
  addString(overview, "rerankerModel", dataset.rerank_id ?? dataset.reranker_model);
  addString(overview, "chatModel", dataset.llm_id ?? dataset.chat_model);
  addString(overview, "language", dataset.language);
  addString(overview, "chunkMethod", dataset.parser_id ?? dataset.chunk_method);
  addNumber(overview, "documentCount", dataset.document_count ?? dataset.doc_num);
  addNumber(overview, "chunkCount", dataset.chunk_count ?? dataset.chunk_num);
  return overview;
}

function addString(
  target: RagflowDatasetOverview,
  key: "name" | "embeddingModel" | "rerankerModel" | "chatModel" | "language" | "chunkMethod",
  value: unknown
): void {
  const normalized = stringValue(value);
  if (normalized) {
    target[key] = normalized;
  }
}

function addNumber(
  target: RagflowDatasetOverview,
  key: "documentCount" | "chunkCount",
  value: unknown
): void {
  const normalized = numberValue(value);
  if (normalized !== undefined) {
    target[key] = normalized;
  }
}

function filterAllowedDocuments(chunks: KnowledgeChunk[], allowedDocumentIds: string[] | undefined): KnowledgeChunk[] {
  if (!allowedDocumentIds) {
    return chunks;
  }
  const allowed = new Set(allowedDocumentIds);
  return chunks.filter((chunk) => allowed.has(chunk.documentId));
}

function mapKnowledgeChunk(chunk: Record<string, unknown>): KnowledgeChunk | undefined {
  const chunkId = stringValue(chunk.id) || stringValue(chunk.chunk_id) || stringValue(chunk.chunkId);
  const documentId = stringValue(chunk.document_id) || stringValue(chunk.documentId);
  const title =
    stringValue(chunk.document_name) ||
    stringValue(chunk.document_keyword) ||
    stringValue(chunk.title) ||
    documentId;

  const knowledgeChunk: KnowledgeChunk = {
    chunkId,
    documentId,
    title,
    content: stringValue(chunk.content) || stringValue(chunk.content_with_weight),
    score: numberValue(chunk.similarity) ?? numberValue(chunk.score) ?? Number.NaN,
    source: stringValue(chunk.source) || title
  };

  const page = numberValue(chunk.page) ?? numberValue(chunk.page_number) ?? numberValue(chunk.pageNumber);
  if (page !== undefined) {
    knowledgeChunk.page = page;
  }

  const section = stringValue(chunk.section) || stringValue(chunk.section_title) || stringValue(chunk.sectionTitle);
  if (section) {
    knowledgeChunk.section = section;
  }

  const position = stringValue(chunk.position) || stringValue(chunk.positions);
  if (position) {
    knowledgeChunk.position = position;
  }

  const location = stringValue(chunk.location) || stringValue(chunk.loc);
  if (location) {
    knowledgeChunk.location = location;
  }

  const snippet = stringValue(chunk.snippet) || stringValue(chunk.highlight) || stringValue(chunk.summary);
  if (snippet) {
    knowledgeChunk.snippet = snippet;
  }

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
