import type { KnowledgeDocumentService } from "../knowledge/knowledge-document.service";
import type { CrmClient, CrmCustomerContext } from "../crm/crm.types";
import { createPrefixedId } from "../ids";
import type { LlmClientPort } from "../llm/llm.types";
import {
  modelElapsedMs,
  modelErrorCode,
  recordLlmGeneration
} from "../llm/llm-generation-audit";
import type { QaCitation } from "../qa/qa.types";
import type { KnowledgeChunk } from "../ragflow/knowledge-chunk";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { CustomerAnalysisAuditLogService } from "./customer-analysis-audit-log.service";
import type {
  CustomerAnalysisConfig,
  CustomerAnalysisItem,
  CustomerAnalysisRequest,
  CustomerAnalysisResult
} from "./customer-analysis.types";

export class CustomerAnalysisService {
  constructor(
    private readonly crmClient: CrmClient,
    private readonly ragflowClient: RagflowClient,
    private readonly auditLog: CustomerAnalysisAuditLogService,
    private readonly config: CustomerAnalysisConfig,
    private readonly llmClient?: LlmClientPort,
    private readonly documentService?: KnowledgeDocumentService,
    private readonly generationAudit?: AuditLogService
  ) {}

  async analyze(request: CustomerAnalysisRequest): Promise<CustomerAnalysisResult> {
    const analysisId = createAnalysisId();
    const userId = request.userId?.trim() || "anonymous-v0";
    this.auditLog.record({
      event: "customer_analysis_started",
      analysisId,
      customerId: request.customerId,
      userId,
      evidenceCount: 0
    });

    const customer = await this.crmClient.getCustomerContext(request.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const chunks = await this.ragflowClient.retrieveKnowledgeChunks({
      datasetId: this.config.datasetId,
      query: buildRetrievalQuery(customer),
      topK: this.config.topK,
      ...(request.user && this.documentService?.hasDocuments()
        ? { allowedDocumentIds: this.documentService.getAccessibleDocumentIds(request.user) }
        : {})
    });
    const evidence = chunks.map(toCitation);
    const basis = evidence.length > 0 ? "evidence" : "inferred";
    const evidenceChunkIds = evidence.map((item) => item.chunkId);

    const result: CustomerAnalysisResult = {
      analysisId,
      status: "completed",
      customerId: customer.customerId,
      customerName: customer.name,
      painPoints: buildPainPoints(customer, basis, evidenceChunkIds),
      risks: buildRisks(customer, basis, evidenceChunkIds),
      entryAngles: buildEntryAngles(customer, basis, evidenceChunkIds),
      recommendedCapabilities: buildCapabilities(customer, basis, evidenceChunkIds),
      evidence
    };

    const narrative = await this.buildNarrative(customer, result, userId);
    result.narrativeSummary = narrative.summary;
    result.narrativeSource = narrative.source;

    this.auditLog.record({
      event: "customer_analysis_completed",
      analysisId,
      customerId: customer.customerId,
      userId,
      evidenceCount: evidence.length
    });

    return result;
  }

  // LLM refines the rule-based analysis into a short narrative; any LLM
  // failure degrades to the rule-based summary so the analysis flow never
  // blocks on the provider.
  private async buildNarrative(
    customer: CrmCustomerContext,
    result: CustomerAnalysisResult,
    actorUserId: string
  ): Promise<{ summary: string; source: "llm" | "rule_based" }> {
    const ruleBased = buildRuleBasedNarrative(result);
    const startedAt = Date.now();
    if (!this.llmClient) {
      recordLlmGeneration(this.generationAudit, {
        actorUserId,
        feature: "customer_analysis",
        elapsedMs: modelElapsedMs(startedAt, Date.now()),
        result: "failure",
        fallbackUsed: true
      });
      return { summary: ruleBased, source: "rule_based" };
    }

    try {
      const completion = await this.llmClient.complete({
        system:
          "你是安全行业售前分析助手。基于给定的客户信息与分析要点，输出不超过150字的客户情况综述。只使用给定信息，不得编造产品能力或客户事实。",
        prompt: JSON.stringify({
          customerName: customer.name,
          industry: customer.industry,
          painPoints: result.painPoints.map((item) => item.title),
          risks: result.risks.map((item) => item.title),
          entryAngles: result.entryAngles.map((item) => item.title),
          recommendedCapabilities: result.recommendedCapabilities.map((item) => item.title),
          evidenceTitles: result.evidence.map((item) => item.title)
        }),
        temperature: 0.3,
        maxTokens: 400
      });
      if (completion.mode !== "real" || !completion.content.trim()) {
        // Mock completions echo the prompt; keep that out of user-visible output.
        recordLlmGeneration(this.generationAudit, {
          actorUserId,
          feature: "customer_analysis",
          provider: completion.provider,
          model: completion.model,
          elapsedMs: modelElapsedMs(startedAt, Date.now()),
          result: "failure",
          fallbackUsed: true,
          ...(completion.mode === "real" ? { errorCode: "MODEL_RESPONSE_INVALID" } : {})
        });
        return { summary: ruleBased, source: "rule_based" };
      }
      recordLlmGeneration(this.generationAudit, {
        actorUserId,
        feature: "customer_analysis",
        provider: completion.provider,
        model: completion.model,
        elapsedMs: modelElapsedMs(startedAt, Date.now()),
        result: "success",
        fallbackUsed: false
      });
      return { summary: completion.content.trim(), source: "llm" };
    } catch (error) {
      const errorCode = modelErrorCode(error);
      recordLlmGeneration(this.generationAudit, {
        actorUserId,
        feature: "customer_analysis",
        elapsedMs: modelElapsedMs(startedAt, Date.now()),
        result: "failure",
        fallbackUsed: true,
        errorCode
      });
      return { summary: ruleBased, source: "rule_based" };
    }
  }
}

function buildRuleBasedNarrative(result: CustomerAnalysisResult): string {
  const painPoint = result.painPoints[0]?.title || "待确认核心痛点";
  const capability = result.recommendedCapabilities[0]?.title || "IP-Guard 基础能力";
  return `${result.customerName}当前关注${painPoint}，建议围绕${capability}组织售前方案与试点验证。`;
}

function buildRetrievalQuery(customer: CrmCustomerContext): string {
  const opportunityText = customer.opportunities.map((opportunity) => opportunity.name).join(" ");
  const followUpText = customer.followUps.map((followUp) => followUp.summary).join(" ");
  return `${customer.name} ${customer.industry} ${opportunityText} ${followUpText}`.trim();
}

function buildPainPoints(
  customer: CrmCustomerContext,
  basis: CustomerAnalysisItem["basis"],
  evidenceChunkIds: string[]
): CustomerAnalysisItem[] {
  return [
    {
      title: "数据外发与终端行为风险",
      detail: customer.followUps[0]?.summary || `${customer.industry}客户需要先确认关键业务场景。`,
      basis,
      evidenceChunkIds
    }
  ];
}

function buildRisks(
  customer: CrmCustomerContext,
  basis: CustomerAnalysisItem["basis"],
  evidenceChunkIds: string[]
): CustomerAnalysisItem[] {
  return [
    {
      title: "方案范围不清导致验收风险",
      detail: `${customer.name}当前机会阶段需要把需求场景、策略边界和审计口径固定下来。`,
      basis: "inferred",
      evidenceChunkIds: basis === "evidence" ? evidenceChunkIds : []
    }
  ];
}

function buildEntryAngles(
  customer: CrmCustomerContext,
  basis: CustomerAnalysisItem["basis"],
  evidenceChunkIds: string[]
): CustomerAnalysisItem[] {
  return [
    {
      title: `${customer.industry}场景化切入`,
      detail: "围绕已确认的业务场景组织演示、试点和验收指标。",
      basis,
      evidenceChunkIds
    }
  ];
}

function buildCapabilities(
  customer: CrmCustomerContext,
  basis: CustomerAnalysisItem["basis"],
  evidenceChunkIds: string[]
): CustomerAnalysisItem[] {
  const purchased = customer.purchasedProducts.map((product) => product.name).join(", ") || "IP-Guard";
  return [
    {
      title: "透明加密、外发审计与终端管控",
      detail: `结合${purchased}基础，优先推荐可被审计和试点验证的能力组合。`,
      basis,
      evidenceChunkIds
    }
  ];
}

function toCitation(chunk: KnowledgeChunk): QaCitation {
  return {
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    title: chunk.title,
    source: chunk.source,
    score: chunk.score
  };
}

function createAnalysisId(): string {
  return createPrefixedId("ca");
}
import type { AuditLogService } from "../audit/audit-log.service";
