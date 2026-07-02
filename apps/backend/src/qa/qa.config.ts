import type { QaConfig } from "./qa.types";

type QaEnv = Partial<Record<"PAS_KB_ID" | "QA_KB_ID" | "QA_TOP_K", string>>;

export function createQaConfig(env: QaEnv = process.env): QaConfig {
  return {
    datasetId: env.QA_KB_ID?.trim() || env.PAS_KB_ID?.trim() || "",
    topK: parsePositiveInteger(env.QA_TOP_K, 5)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
