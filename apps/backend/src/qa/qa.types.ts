import type { KnowledgeChunk } from "../ragflow/knowledge-chunk";

export type QaAskRequest = {
  query: string;
  userId?: string;
  topK?: number;
};

export type QaCitation = {
  chunkId: string;
  documentId: string;
  title: string;
  source: string;
  score: number;
  page?: number;
  section?: string;
  position?: string;
  location?: string;
  snippet?: string;
};

export type QaAnswerStatus = "answered" | "no_hit" | "error";

export type QaAskResponse = {
  questionId: string;
  status: QaAnswerStatus;
  answer: string;
  citations: QaCitation[];
  failureReason?: "NO_RELEVANT_KNOWLEDGE_CHUNKS";
  error?: {
    code: "RAGFLOW_RETRIEVAL_FAILED" | "LLM_DRAFT_FAILED";
    message: string;
  };
};

export type QaConfig = {
  datasetId: string;
  topK: number;
};

export type QaDraftInput = {
  query: string;
  chunks: KnowledgeChunk[];
};

export type QaDraftProvider = {
  generateDraft(input: QaDraftInput): Promise<string>;
};

export type QaAuditEvent = {
  event: "qa_request_received" | "qa_retrieval_failed" | "qa_answer_generated";
  questionId: string;
  userId: string;
  status: QaAnswerStatus;
  citationCount: number;
};
