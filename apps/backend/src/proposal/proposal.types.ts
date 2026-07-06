import type { AuthenticatedUser } from "../auth/auth.types";
import type { CustomerAnalysisResult } from "../customer-analysis/customer-analysis.types";
import type { QaCitation } from "../qa/qa.types";

export type ProposalFormat = "docx" | "pptx" | "xlsx";

export type ProposalHumanInput = {
  inputId: string;
  label: string;
  value: string;
};

export type ProposalGenerationRequest = {
  customerId: string;
  userId?: string;
  user?: AuthenticatedUser;
  humanInputs?: ProposalHumanInput[];
};

export type ProposalTrace = {
  source: "citation" | "human_input";
  chunkId?: string;
  inputId?: string;
  label: string;
  note: string;
};

export type ProposalDraftSection = {
  sectionId: string;
  title: string;
  body: string;
  traces: ProposalTrace[];
};

export type ProposalDraft = {
  draftId: string;
  customerId: string;
  customerName: string;
  title: string;
  reviewRequired: true;
  generatedAt: string;
  sections: ProposalDraftSection[];
  citations: QaCitation[];
  assumptions: string[];
};

export type ExportPackage = {
  packageId: string;
  proposalDraftId: string;
  customerId: string;
  status: "ready_for_export";
  formats: ProposalFormat[];
  payload: {
    customerAnalysisId: string;
    proposalDraft: ProposalDraft;
  };
};

export type ProposalProgressStep =
  | "accepted"
  | "customer_analysis"
  | "draft_created"
  | "export_package_ready"
  | "failed";

export type ProposalProgressRecord = {
  step: ProposalProgressStep;
  status: "running" | "completed" | "failed";
  message: string;
  at: string;
};

export type ProposalJobStatus = "running" | "completed" | "failed";

export type ProposalFailureReason = "CUSTOMER_ANALYSIS_FAILED" | "PROPOSAL_DRAFT_FAILED";

export type ProposalJob = {
  jobId: string;
  status: ProposalJobStatus;
  request: ProposalGenerationRequest;
  progress: ProposalProgressRecord[];
  createdAt: string;
  updatedAt: string;
  draft?: ProposalDraft;
  exportPackage?: ExportPackage;
  failureReason?: ProposalFailureReason;
};

export type ProposalAuditEvent = {
  event: "proposal_generation_started" | "proposal_generation_completed" | "proposal_generation_failed";
  jobId: string;
  customerId: string;
  userId: string;
  citationCount: number;
  failureReason?: ProposalFailureReason;
};

export type ProposalBuildContext = {
  analysis: CustomerAnalysisResult;
  request: ProposalGenerationRequest;
};

export type ProposalDraftProvider = {
  generateDraft(context: ProposalBuildContext): Promise<ProposalDraft>;
};
