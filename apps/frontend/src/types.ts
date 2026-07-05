export type PublicUser = {
  userId: string;
  username: string;
  displayName: string;
  role: "sales" | "presales" | "admin";
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: PublicUser;
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

export type QaAskResponse = {
  questionId: string;
  status: "answered" | "no_hit" | "error";
  answer: string;
  citations: QaCitation[];
};

export type CrmCustomerSummary = {
  customerId: string;
  name: string;
  industry: string;
  region: string;
  accountOwner: string;
};

export type CustomerAnalysisItem = {
  title: string;
  detail: string;
  basis: "evidence" | "inferred";
};

export type CustomerAnalysisResult = {
  analysisId: string;
  customerId: string;
  customerName: string;
  painPoints: CustomerAnalysisItem[];
  risks: CustomerAnalysisItem[];
  entryAngles: CustomerAnalysisItem[];
  recommendedCapabilities: CustomerAnalysisItem[];
  evidence: QaCitation[];
  narrativeSummary?: string;
  narrativeSource?: "llm" | "rule_based";
};

export type ProposalDraftSection = {
  sectionId: string;
  title: string;
  body: string;
};

export type ProposalDraft = {
  draftId: string;
  customerName: string;
  title: string;
  generatedAt: string;
  sections: ProposalDraftSection[];
  citations: QaCitation[];
  assumptions: string[];
};

export type ProposalProgressRecord = {
  step: string;
  status: "running" | "completed" | "failed";
  message: string;
  at: string;
};

export type ExportPackage = {
  packageId: string;
  customerId: string;
  payload: {
    proposalDraft: ProposalDraft;
  };
};

export type ProposalJob = {
  jobId: string;
  status: "running" | "completed" | "failed";
  progress: ProposalProgressRecord[];
  draft?: ProposalDraft;
  exportPackage?: ExportPackage;
  failureReason?: string;
};

export type ExportFormat = "docx" | "pptx" | "xlsx";

export type ExportFormatRecord =
  | { format: ExportFormat; status: "completed"; fileName: string; size: number }
  | { format: ExportFormat; status: "failed"; errorMessage: string };

export type ExportJob = {
  jobId: string;
  status: "completed" | "partial" | "failed";
  formats: ExportFormatRecord[];
};

export type ExportDownloadResponse = {
  fileName: string;
  contentType: string;
  contentBase64: string;
  size: number;
};

export type KnowledgeBlockStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "disabled"
  | "expired";

export type KnowledgeBlock = {
  blockId: string;
  title: string;
  product: string;
  scenario: string;
  body: string;
  citations: QaCitation[];
  tags: string[];
  source?: {
    type: "ragflow_chunk" | "manual" | "feedback" | "historical_proposal";
    referenceId?: string;
  };
  status: KnowledgeBlockStatus;
  version: number;
  ownerUserId: string;
  reviewerUserId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  reviewNote?: string;
};
