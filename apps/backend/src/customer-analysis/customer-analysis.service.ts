import type { CrmClient, CrmCustomerContext } from "../crm/crm.types";
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
    private readonly config: CustomerAnalysisConfig
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
      topK: this.config.topK
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

    this.auditLog.record({
      event: "customer_analysis_completed",
      analysisId,
      customerId: customer.customerId,
      userId,
      evidenceCount: evidence.length
    });

    return result;
  }
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
  return `ca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
