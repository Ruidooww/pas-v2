import { describe, expect, it, vi } from "vitest";
import type { CrmClient, CrmCustomerContext } from "../crm/crm.types";
import type { LlmClientPort } from "../llm/llm.types";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { CustomerAnalysisAuditLogService } from "./customer-analysis-audit-log.service";
import { CustomerAnalysisService } from "./customer-analysis.service";

const customer: CrmCustomerContext = {
  customerId: "customer-1",
  name: "Huaxin Precision",
  industry: "manufacturing",
  region: "east",
  companySize: "500-1000",
  contacts: [],
  opportunities: [{ opportunityId: "op-1", name: "terminal security", stage: "proposal", budget: "" }],
  followUps: [{ followUpId: "fu-1", summary: "concerned about data leak", at: "2026-07-01" }],
  purchasedProducts: [],
  contracts: []
} as unknown as CrmCustomerContext;

function buildService(llmClient?: LlmClientPort): CustomerAnalysisService {
  const crmClient = {
    getCustomerContext: vi.fn().mockResolvedValue(customer)
  } as unknown as CrmClient;
  const ragflowClient = {
    retrieveKnowledgeChunks: vi.fn().mockResolvedValue([])
  } as unknown as RagflowClient;
  return new CustomerAnalysisService(
    crmClient,
    ragflowClient,
    new CustomerAnalysisAuditLogService(),
    { datasetId: "kb-1", topK: 5 },
    llmClient
  );
}

describe("CustomerAnalysisService narrative", () => {
  it("uses the llm narrative when the provider succeeds in real mode", async () => {
    const llmClient: LlmClientPort = {
      complete: vi.fn().mockResolvedValue({ content: "LLM 客户综述", model: "qwen-max", mode: "real" })
    };
    const result = await buildService(llmClient).analyze({ customerId: "customer-1" });
    expect(result.narrativeSummary).toBe("LLM 客户综述");
    expect(result.narrativeSource).toBe("llm");
  });

  it("marks mock-mode completions as rule_based so callers know no real llm ran", async () => {
    const llmClient: LlmClientPort = {
      complete: vi.fn().mockResolvedValue({ content: "[mock-llm] x", model: "mock", mode: "mock" })
    };
    const result = await buildService(llmClient).analyze({ customerId: "customer-1" });
    expect(result.narrativeSource).toBe("rule_based");
  });

  it("degrades to the rule-based narrative when the llm fails", async () => {
    const llmClient: LlmClientPort = {
      complete: vi.fn().mockRejectedValue(new Error("provider down"))
    };
    const result = await buildService(llmClient).analyze({ customerId: "customer-1" });
    expect(result.narrativeSource).toBe("rule_based");
    expect(result.narrativeSummary).toContain("Huaxin Precision");
  });

  it("works without an llm client at all", async () => {
    const result = await buildService(undefined).analyze({ customerId: "customer-1" });
    expect(result.narrativeSource).toBe("rule_based");
    expect(result.narrativeSummary).toBeTruthy();
  });
});
