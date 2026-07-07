import { describe, expect, it, vi } from "vitest";
import type { CustomerAnalysisResult } from "../customer-analysis/customer-analysis.types";
import type { CustomerAnalysisService } from "../customer-analysis/customer-analysis.service";
import { ProposalAuditLogService } from "./proposal-audit-log.service";
import { LocalProposalDraftProvider } from "./proposal-draft.provider";
import { ProposalJobStoreService } from "./proposal-job-store.service";
import { ProposalJobAccessDeniedError, ProposalJobRetryRejectedError, ProposalService } from "./proposal.service";
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
      user: createUser("user-1", "presales"),
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
      userId: "user-1",
      user: createUser("user-1", "presales")
    });
    expect(job).toEqual(
      expect.objectContaining({
        jobId: expect.stringMatching(/^proposal-job-/),
        status: "completed",
        failureReason: undefined
      })
    );
    expect(job.request).not.toHaveProperty("user");
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
      userId: "user-1",
      user: createUser("user-1", "presales")
    });
    const retryActor = createUser("user-1", "sales");
    const retriedJob = await service.retry(failedJob.jobId, retryActor);

    expect(retriedJob.jobId).toBe(failedJob.jobId);
    expect(retriedJob.status).toBe("completed");
    expect(retriedJob.exportPackage?.status).toBe("ready_for_export");
    expect(customerAnalysisService.analyze).toHaveBeenCalledTimes(2);
    expect(customerAnalysisService.analyze).toHaveBeenNthCalledWith(2, {
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1",
      user: retryActor
    });
  });

  it("rejects retry for jobs that are not failed", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockResolvedValue(completedAnalysis)
    } as unknown as CustomerAnalysisService;
    const { service } = createService(customerAnalysisService);

    const job = await service.generate({
      customerId: "demo-huaxin-manufacturing",
      userId: "user-1",
      user: createUser("user-1", "presales")
    });

    await expect(service.retry(job.jobId, createUser("user-1", "presales"))).rejects.toBeInstanceOf(
      ProposalJobRetryRejectedError
    );
  });

  it("allows only the owner or admin to read and retry proposal jobs", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockRejectedValue(new Error("RAGFlow timeout"))
    } as unknown as CustomerAnalysisService;
    const { service } = createService(customerAnalysisService);

    const failedJob = await service.generate({
      customerId: "demo-huaxin-manufacturing",
      userId: "owner-1"
    });

    expect(service.getJobForUser(failedJob.jobId, createUser("owner-1", "presales"))).toEqual(failedJob);
    expect(service.getJobForUser(failedJob.jobId, createUser("admin-1", "admin"))).toEqual(failedJob);
    expect(() => service.getJobForUser(failedJob.jobId, createUser("other-1", "presales"))).toThrow(
      ProposalJobAccessDeniedError
    );
    await expect(service.retry(failedJob.jobId, createUser("other-1", "presales"))).rejects.toBeInstanceOf(
      ProposalJobAccessDeniedError
    );
  });

  it("lists proposal jobs visible to the requesting user", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockResolvedValue(completedAnalysis)
    } as unknown as CustomerAnalysisService;
    const { service } = createService(customerAnalysisService);

    const ownerJob = await service.generate({
      customerId: "demo-huaxin-manufacturing",
      userId: "owner-1",
      user: createUser("owner-1", "presales")
    });
    const otherJob = await service.generate({
      customerId: "demo-chenyu-energy",
      userId: "other-1",
      user: createUser("other-1", "sales")
    });

    expect(service.listJobsForUser(createUser("owner-1", "presales")).map((job) => job.jobId)).toEqual([
      ownerJob.jobId
    ]);
    const adminJobIds = service.listJobsForUser(createUser("admin-1", "admin")).map((job) => job.jobId);
    expect(adminJobIds).toHaveLength(2);
    expect(adminJobIds).toEqual(expect.arrayContaining([ownerJob.jobId, otherJob.jobId]));
  });

  it("lists generated proposal drafts plus mock samples for the proposal library", async () => {
    const customerAnalysisService = {
      analyze: vi.fn().mockResolvedValue(completedAnalysis)
    } as unknown as CustomerAnalysisService;
    const { service } = createService(customerAnalysisService);

    const job = await service.generate({
      customerId: "demo-huaxin-manufacturing",
      userId: "owner-1",
      user: createUser("owner-1", "presales")
    });
    const ownerLibrary = service.listLibrary(createUser("owner-1", "presales"));
    const otherLibrary = service.listLibrary(createUser("other-1", "presales"));

    expect(ownerLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          libraryId: job.draft?.draftId,
          source: "generated",
          status: "export_ready"
        }),
        expect.objectContaining({
          libraryId: "sample-huaxin-dlp",
          source: "mock"
        })
      ])
    );
    expect(otherLibrary.some((item) => item.libraryId === job.draft?.draftId)).toBe(false);
    expect(otherLibrary.some((item) => item.source === "mock")).toBe(true);
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
      userId: "user-1",
      user: createUser("user-1", "presales")
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

function createUser(userId: string, role: "sales" | "presales" | "admin") {
  return {
    userId,
    username: `${userId}@example.com`,
    displayName: userId,
    role
  };
}
