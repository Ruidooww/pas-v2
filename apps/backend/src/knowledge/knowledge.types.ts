import type { QaCitation } from "../qa/qa.types";

export type KnowledgeBlockStatus = "draft" | "pending_review" | "published" | "rejected" | "disabled" | "expired";

export type KnowledgeBlockSourceType = "ragflow_chunk" | "manual" | "feedback" | "historical_proposal";

export type KnowledgeBlockSource = {
  type: KnowledgeBlockSourceType;
  referenceId?: string;
};

export type CreateKnowledgeBlockRequest = {
  title: string;
  product: string;
  scenario: string;
  body: string;
  citations?: QaCitation[];
  tags?: string[];
  source?: KnowledgeBlockSource;
  expiresAt?: string;
};

export type KnowledgeBlock = CreateKnowledgeBlockRequest & {
  blockId: string;
  status: KnowledgeBlockStatus;
  version: number;
  ownerUserId: string;
  reviewerUserId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  reviewNote?: string;
};

export type KnowledgeBlockListFilter = {
  status?: KnowledgeBlockStatus;
  publishedOnly?: boolean;
};

export type ReviewKnowledgeBlockRequest = {
  decision: "approve" | "reject";
  reviewNote?: string;
};

export type KnowledgeDocumentParseStatus = "pending" | "parsing" | "done" | "failed";

export type KnowledgeDocumentMaterialType = "pdf" | "pptx" | "docx" | "xlsx" | "image" | "scan" | "other";

export type UpsertKnowledgeDocumentRequest = {
  documentId: string;
  title: string;
  product: string;
  materialType: KnowledgeDocumentMaterialType;
  sourceName: string;
  parseStatus: KnowledgeDocumentParseStatus;
  chunkCount?: number;
  hitCount?: number;
  badFeedbackCount?: number;
  tags?: string[];
  failureReason?: string;
};

export type KnowledgeDocument = UpsertKnowledgeDocumentRequest & {
  enabled: boolean;
  chunkCount: number;
  hitCount: number;
  badFeedbackCount: number;
  tags: string[];
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  disabledReason?: string;
  reparseRequestedAt?: string;
  reparseRequestedBy?: string;
  reparseReason?: string;
};

export type KnowledgeDocumentListFilter = {
  parseStatus?: KnowledgeDocumentParseStatus;
  enabled?: boolean;
  product?: string;
  tag?: string;
};
