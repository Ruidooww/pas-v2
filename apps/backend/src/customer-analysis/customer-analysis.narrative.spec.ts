import { describe, expect, it, vi } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { CrmClient, CrmCustomerContext } from "../crm/crm.types";
import type { LlmClientPort } from "../llm/llm.types";
import { LlmRequestError } from "../llm/llm.errors";
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

function buildService(llmClient?: LlmClientPort, generationAudit?: AuditLogService): CustomerAnalysisService {
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
    llmClient,
    undefined,
    generationAudit
  );
}

describe("CustomerAnalysisService narrative", () => {
  it("uses the llm narrative when the provider succeeds in real mode", async () => {
    const generationAudit = new AuditLogService();
    const llmClient: LlmClientPort = {
      complete: vi.fn().mockResolvedValue({
        content: "LLM 客户综述",
        model: "qwen-max",
        mode: "real",
        provider: "bailian",
        source: "database"
      })
    };
    const result = await buildService(llmClient, generationAudit).analyze({
      customerId: "customer-1",
      userId: "user-1"
    });
    expect(result.narrativeSummary).toBe("LLM 客户综述");
    expect(result.narrativeSource).toBe("llm");
    expect(generationAudit.list()).toEqual([
      expect.objectContaining({
        action: "llm_generation",
        actorUserId: "user-1",
        result: "success",
        metadata: expect.objectContaining({
          feature: "customer_analysis",
          provider: "bailian",
          model: "qwen-max",
          fallbackUsed: false
        })
      })
    ]);
  });

  it("marks mock-mode completions as rule_based so callers know no real llm ran", async () => {
    const generationAudit = new AuditLogService();
    const llmClient: LlmClientPort = {
      complete: vi.fn().mockResolvedValue({ content: "[mock-llm] x", model: "mock", mode: "mock", source: "mock" })
    };
    const result = await buildService(llmClient, generationAudit).analyze({ customerId: "customer-1" });
    expect(result.narrativeSource).toBe("rule_based");
    expect(result.narrativeSummary).not.toContain("[mock-llm]");
    expect(generationAudit.list()[0]).toEqual(
      expect.objectContaining({
        action: "llm_generation",
        result: "failure",
        metadata: expect.objectContaining({ feature: "customer_analysis", fallbackUsed: true })
      })
    );
  });

  it("degrades to the rule-based narrative when the llm fails", async () => {
    const generationAudit = new AuditLogService();
    const llmClient: LlmClientPort = {
      complete: vi.fn().mockRejectedValue(new LlmRequestError("MODEL_PROVIDER_UNAVAILABLE", "provider down"))
    };
    const result = await buildService(llmClient, generationAudit).analyze({ customerId: "customer-1" });
    expect(result.narrativeSource).toBe("rule_based");
    expect(result.narrativeSummary).toContain("Huaxin Precision");
    expect(generationAudit.list()[0]).toEqual(
      expect.objectContaining({
        result: "failure",
        failureReason: "MODEL_PROVIDER_UNAVAILABLE",
        metadata: expect.objectContaining({ fallbackUsed: true, errorCode: "MODEL_PROVIDER_UNAVAILABLE" })
      })
    );
  });

  it("works without an llm client at all", async () => {
    const result = await buildService(undefined).analyze({ customerId: "customer-1" });
    expect(result.narrativeSource).toBe("rule_based");
    expect(result.narrativeSummary).toBeTruthy();
  });
});
