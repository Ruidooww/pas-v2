import { describe, expect, it, vi } from "vitest";
import type { CrmClient } from "../crm/crm.types";
import type { RagflowClient } from "../ragflow/ragflow.client";
import { CustomerAnalysisAuditLogService } from "./customer-analysis-audit-log.service";
import { CustomerAnalysisService } from "./customer-analysis.service";

describe("CustomerAnalysisService", () => {
  it("generates fixed-structure analysis from CRM context and RAGFlow evidence", async () => {
    const crmClient = {
      getCustomerContext: vi.fn().mockResolvedValue({
        customerId: "demo-huaxin-manufacturing",
        name: "华信精工",
        industry: "高端制造",
        region: "华东",
        accountOwner: "售前一组",
        contacts: [],
        opportunities: [
          {
            opportunityId: "opp-1",
            name: "终端数据防泄漏与透明加密扩容",
            stage: "proposal",
            estimatedValue: 380000,
            expectedCloseDate: "2026-09-30"
          }
        ],
        purchasedProducts: [
          {
            name: "IP-Guard",
            version: "V4",
            activeSeats: 1200
          }
        ],
        followUps: [
          {
            happenedAt: "2026-06-20",
            owner: "售前一组",
            summary: "客户关注研发图纸外发审计、U 盘管控和离职交接场景。"
          }
        ]
      })
    } as unknown as CrmClient;
    const ragflowClient = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue([
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          title: "IP-Guard 能力说明",
          content: "IP-Guard 支持透明加密、外发审计和终端管控。",
          score: 0.89,
          source: "ip-guard.pdf"
        }
      ])
    } as unknown as RagflowClient;
    const auditLog = new CustomerAnalysisAuditLogService();
    const service = new CustomerAnalysisService(crmClient, ragflowClient, auditLog, {
      datasetId: "pas-v0",
      topK: 5
    });

    const result = await service.analyze({ customerId: "demo-huaxin-manufacturing", userId: "user-1" });

    expect(result).toEqual(
      expect.objectContaining({
        analysisId: expect.stringMatching(/^ca-/),
        status: "completed",
        customerId: "demo-huaxin-manufacturing",
        customerName: "华信精工",
        painPoints: expect.arrayContaining([
          expect.objectContaining({
            basis: "evidence",
            evidenceChunkIds: ["chunk-1"]
          })
        ]),
        risks: expect.any(Array),
        entryAngles: expect.any(Array),
        recommendedCapabilities: expect.any(Array),
        evidence: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            title: "IP-Guard 能力说明",
            source: "ip-guard.pdf",
            score: 0.89
          }
        ]
      })
    );
    expect(ragflowClient.retrieveKnowledgeChunks).toHaveBeenCalledWith({
      datasetId: "pas-v0",
      query: expect.stringContaining("华信精工"),
      topK: 5
    });
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "customer_analysis_completed",
          customerId: "demo-huaxin-manufacturing",
          userId: "user-1"
        })
      ])
    );
  });

  it("marks judgments as inferred when no evidence chunks are returned", async () => {
    const crmClient = {
      getCustomerContext: vi.fn().mockResolvedValue({
        customerId: "demo-lanyun-software",
        name: "岚云软件",
        industry: "软件研发",
        region: "华北",
        accountOwner: "软件行业组",
        contacts: [],
        opportunities: [],
        purchasedProducts: [],
        followUps: []
      })
    } as unknown as CrmClient;
    const ragflowClient = {
      retrieveKnowledgeChunks: vi.fn().mockResolvedValue([])
    } as unknown as RagflowClient;
    const service = new CustomerAnalysisService(crmClient, ragflowClient, new CustomerAnalysisAuditLogService(), {
      datasetId: "pas-v0",
      topK: 5
    });

    const result = await service.analyze({ customerId: "demo-lanyun-software" });

    expect(result.evidence).toEqual([]);
    expect(result.painPoints.every((item) => item.basis === "inferred")).toBe(true);
  });
});
