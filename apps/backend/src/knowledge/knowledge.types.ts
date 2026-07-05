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
