import type { QaCitation } from "../qa/qa.types";

export type AnalysisBasis = "evidence" | "inferred";

export type CustomerAnalysisRequest = {
  customerId: string;
  userId?: string;
};

export type CustomerAnalysisItem = {
  title: string;
  detail: string;
  basis: AnalysisBasis;
  evidenceChunkIds: string[];
};

export type CustomerAnalysisResult = {
  analysisId: string;
  status: "completed";
  customerId: string;
  customerName: string;
  painPoints: CustomerAnalysisItem[];
  risks: CustomerAnalysisItem[];
  entryAngles: CustomerAnalysisItem[];
  recommendedCapabilities: CustomerAnalysisItem[];
  evidence: QaCitation[];
};

export type CustomerAnalysisConfig = {
  datasetId: string;
  topK: number;
};

export type CustomerAnalysisAuditEvent = {
  event: "customer_analysis_started" | "customer_analysis_completed";
  analysisId: string;
  customerId: string;
  userId: string;
  evidenceCount: number;
};
