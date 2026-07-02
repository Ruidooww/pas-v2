import type { CustomerAnalysisConfig } from "./customer-analysis.types";

type CustomerAnalysisEnv = Partial<Record<"CUSTOMER_ANALYSIS_TOP_K" | "PAS_KB_ID" | "QA_KB_ID", string>>;

export function createCustomerAnalysisConfig(env: CustomerAnalysisEnv = process.env): CustomerAnalysisConfig {
  return {
    datasetId: env.PAS_KB_ID?.trim() || env.QA_KB_ID?.trim() || "",
    topK: parsePositiveInteger(env.CUSTOMER_ANALYSIS_TOP_K, 5)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
