import type { KnowledgeDocumentService } from "../knowledge/knowledge-document.service";
import type { RagflowClient } from "../ragflow/ragflow.client";
import type { KnowledgeChunk } from "../ragflow/knowledge-chunk";
import { createPrefixedId } from "../ids";
import { QaAuditLogService } from "./qa-audit-log.service";
import type { QaAskRequest, QaAskResponse, QaCitation, QaConfig, QaDraftProvider } from "./qa.types";

export class QaService {
  constructor(
    private readonly ragflowClient: RagflowClient,
    private readonly draftProvider: QaDraftProvider,
    private readonly auditLog: QaAuditLogService,
    private readonly config: QaConfig,
    private readonly documentService?: KnowledgeDocumentService
  ) {}

  async ask(request: QaAskRequest): Promise<QaAskResponse> {
    const questionId = createQuestionId();
    const query = request.query.trim();
    const userId = request.userId?.trim() || "anonymous-v0";

    this.auditLog.record({
      event: "qa_request_received",
      questionId,
      userId,
      status: "answered",
      citationCount: 0
    });

    let chunks: KnowledgeChunk[];
    let allowedDocumentIds: string[] | undefined;
    try {
      allowedDocumentIds =
        request.user && this.documentService?.hasDocuments()
          ? this.documentService.getAccessibleDocumentIds(request.user)
          : undefined;
      chunks = await this.ragflowClient.retrieveKnowledgeChunks({
        datasetId: this.config.datasetId,
        query,
        topK: request.topK ?? this.config.topK,
        ...(allowedDocumentIds ? { allowedDocumentIds } : {})
      });
      if (allowedDocumentIds) {
        const allowed = new Set(allowedDocumentIds);
        chunks = chunks.filter((chunk) => allowed.has(chunk.documentId));
      }
    } catch {
      this.auditLog.record({
        event: "qa_retrieval_failed",
        questionId,
        userId,
        status: "error",
        citationCount: 0
      });

      return {
        questionId,
        status: "error",
        answer: "",
        citations: [],
        error: {
          code: "RAGFLOW_RETRIEVAL_FAILED",
          message: "Knowledge retrieval failed"
        }
      };
    }

    if (chunks.length === 0) {
      return {
        questionId,
        status: "no_hit",
        answer: "",
        citations: [],
        failureReason: "NO_RELEVANT_KNOWLEDGE_CHUNKS"
      };
    }

    try {
      const answer = await this.draftProvider.generateDraft({ query, actorUserId: userId, chunks });
      const citations = chunks.map(toCitation);

      this.auditLog.record({
        event: "qa_answer_generated",
        questionId,
        userId,
        status: "answered",
        citationCount: citations.length
      });

      return {
        questionId,
        status: "answered",
        answer,
        citations
      };
    } catch {
      return {
        questionId,
        status: "error",
        answer: "",
        citations: chunks.map(toCitation),
        error: {
          code: "LLM_DRAFT_FAILED",
          message: "Answer draft generation failed"
        }
      };
    }
  }
}

function toCitation(chunk: KnowledgeChunk): QaCitation {
  const citation: QaCitation = {
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    title: chunk.title,
    source: chunk.source,
    score: chunk.score
  };

  if (chunk.page !== undefined) {
    citation.page = chunk.page;
  }
  if (chunk.section) {
    citation.section = chunk.section;
  }
  if (chunk.position) {
    citation.position = chunk.position;
  }
  if (chunk.location) {
    citation.location = chunk.location;
  }
  if (chunk.snippet) {
    citation.snippet = chunk.snippet;
  }

  return citation;
}

function createQuestionId(): string {
  return createPrefixedId("qa");
}
