import { describe, expect, it, vi } from "vitest";
import type { CustomerAnalysisResult } from "../customer-analysis/customer-analysis.types";
import type { CustomerAnalysisService } from "../customer-analysis/customer-analysis.service";
import { ProposalAuditLogService } from "./proposal-audit-log.service";
import { LocalProposalDraftProvider } from "./proposal-draft.provider";
import { ProposalJobStoreService } from "./proposal-job-store.service";
import { ProposalJobRetryRejectedError, ProposalService } from "./proposal.service";
import type { ProposalDraftProvider } from "./proposal.types";

const completedAnalysis: CustomerAnalysisResult = {
  analysisId: "ca-1",
  status: "completed",
  customerId: "demo-huaxin-manufacturing",
  customerName: "Huaxin Precision",
  painPoints: [
    {
      title: "External sharing audit gap",
      detail: "Engineering files need traceable external sharing controls.",
      basis: "evidence",
      evidenceChunkIds: ["chunk-1"]
    }
  ],
  risks: [
    {
      title: "Unclear acceptance scope",
      detail: "Pilot acceptance must define audit reports and endpoint policy coverage.",
      basis: "inferred",
      evidenceChunkIds: []
    }
  ],
  entryAngles: [
    {
      title: "Pilot around engineering documents",
      detail: "Start from transparent encryption and outbound audit.",
      basis: "evidence",
      evidenceChunkIds: ["chunk-1"]
    }
  ],
  recommendedCapabilities: [
    {
      title: "Transparent encryption and outbound audit",
      detail: "Use IP-Guard capabilities for encrypted files, external sharing audit, and endpoint control.",
      basis: "evidence",
      evidenceChunkIds: ["chunk-1"]
    }
  ],
  evidence: [
    {
      chunkId: "chunk-1",
      documentId: "doc-1",
      title: "IP-Guard capability guide",
      source: "ip-guard-guide.pdf",
      score: 0.91
    }
  ]
};

describe("ProposalService", () => {
  it("generates a reviewable proposal draft and export package from customer analysis evidence", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockResolvedValue(completedAnalysis)
    } as unknown as CustomerAnalysisService;
    const { service, auditLog } = createService(customerAnalysisService);

    const job = await service.generate({
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1",
      humanInputs: [
        {
          inputId: "input-1",
          label: "Budget note",
          value: "Initial V0 budget confirmed by sales."
        }
      ]
    });

    expect(customerAnalysisService.analyze).toHaveBeenCalledWith({
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1"
    });
    expect(job).toEqual(
      expect.objectContaining({
        jobId: expect.stringMatching(/^proposal-job-/),
        status: "completed",
        failureReason: undefined
      })
    );
    expect(job.draft).toEqual(
      expect.objectContaining({
        draftId: expect.stringMatching(/^proposal-draft-/),
        customerId: "demo-huaxin-manufacturing",
        customerName: "Huaxin Precision",
        reviewRequired: true,
        citations: completedAnalysis.evidence,
        sections: expect.arrayContaining([
          expect.objectContaining({
            sectionId: "recommended-solution",
            title: "Recommended IP-Guard solution",
            traces: expect.arrayContaining([
              expect.objectContaining({
                source: "citation",
                chunkId: "chunk-1"
              })
            ])
          }),
          expect.objectContaining({
            sectionId: "commercial-inputs",
            traces: expect.arrayContaining([
              expect.objectContaining({
                source: "human_input",
                inputId: "input-1"
              })
            ])
          })
        ])
      })
    );
    expect(job.exportPackage).toEqual(
      expect.objectContaining({
        packageId: expect.stringMatching(/^export-package-/),
        proposalDraftId: job.draft?.draftId,
        customerId: "demo-huaxin-manufacturing",
        status: "ready_for_export",
        formats: ["docx", "pptx", "xlsx"],
        payload: expect.objectContaining({
          customerAnalysisId: "ca-1",
          proposalDraft: job.draft
        })
      })
    );
    expect(service.getJob(job.jobId)).toEqual(job);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "proposal_generation_completed",
          jobId: job.jobId,
          citationCount: 1
        })
      ])
    );
  });

  it("stores failed jobs without an export package when customer analysis fails", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockRejectedValue(new Error("Customer not found"))
    } as unknown as CustomerAnalysisService;
    const { service } = createService(customerAnalysisService);

    const job = await service.generate({
      customerId: "missing-customer",
      userId: "user-1"
    });

    expect(job.status).toBe("failed");
    expect(job.failureReason).toBe("CUSTOMER_ANALYSIS_FAILED");
    expect(job.draft).toBeUndefined();
    expect(job.exportPackage).toBeUndefined();
    expect(service.getJob(job.jobId)?.exportPackage).toBeUndefined();
  });

  it("retries failed jobs with the original request and completes them", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockRejectedValueOnce(new Error("RAGFlow timeout")).mockResolvedValueOnce(completedAnalysis)
    } as unknown as CustomerAnalysisService;
    const { service } = createService(customerAnalysisService);

    const failedJob = await service.generate({
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1"
    });
    const retriedJob = await service.retry(failedJob.jobId);

    expect(retriedJob.jobId).toBe(failedJob.jobId);
    expect(retriedJob.status).toBe("completed");
    expect(retriedJob.exportPackage?.status).toBe("ready_for_export");
    expect(customerAnalysisService.analyze).toHaveBeenCalledTimes(2);
    expect(customerAnalysisService.analyze).toHaveBeenNthCalledWith(2, {
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1"
    });
  });

  it("rejects retry for jobs that are not failed", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockResolvedValue(completedAnalysis)
    } as unknown as CustomerAnalysisService;
    const { service } = createService(customerAnalysisService);

    const job = await service.generate({
      customerId: "demo-huaxin-manufacturing"
    });

    await expect(service.retry(job.jobId)).rejects.toBeInstanceOf(ProposalJobRetryRejectedError);
  });

  it("stores failed jobs without an export package when draft provider fails", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockResolvedValue(completedAnalysis)
    } as unknown as CustomerAnalysisService;
    const draftProvider = {
      generateDraft: vi.fn().mockRejectedValue(new Error("LLM provider failed"))
    } as unknown as ProposalDraftProvider;
    const { service } = createService(customerAnalysisService, draftProvider);

    const job = await service.generate({
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1"
    });

    expect(job.status).toBe("failed");
    expect(job.failureReason).toBe("PROPOSAL_DRAFT_FAILED");
    expect(job.draft).toBeUndefined();
    expect(job.exportPackage).toBeUndefined();
  });
});

function createService(
  customerAnalysisService: CustomerAnalysisService,
  draftProvider: ProposalDraftProvider = new LocalProposalDraftProvider()
): { service: ProposalService; auditLog: ProposalAuditLogService } {
  const auditLog = new ProposalAuditLogService();
  const service = new ProposalService(
    customerAnalysisService,
    new ProposalJobStoreService(),
    auditLog,
    draftProvider
  );
  return { service, auditLog };
}
