import type { AuthenticatedUser } from "../auth/auth.types";
import type { CustomerAnalysisResult } from "../customer-analysis/customer-analysis.types";
import type { CustomerAnalysisService } from "../customer-analysis/customer-analysis.service";
import { createPrefixedId } from "../ids";
import { ProposalAuditLogService } from "./proposal-audit-log.service";
import { ProposalJobStoreService } from "./proposal-job-store.service";
import type {
  ExportPackage,
  ProposalDraft,
  ProposalFailureReason,
  ProposalGenerationRequest,
  ProposalJob,
  ProposalLibraryItem,
  ProposalProgressRecord,
  ProposalDraftProvider
} from "./proposal.types";

export class ProposalJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Proposal job not found: ${jobId}`);
    this.name = "ProposalJobNotFoundError";
  }
}

export class ProposalJobRetryRejectedError extends Error {
  constructor(jobId: string) {
    super(`Proposal job cannot be retried unless it failed: ${jobId}`);
    this.name = "ProposalJobRetryRejectedError";
  }
}

export class ProposalJobAccessDeniedError extends Error {
  constructor(jobId: string) {
    super(`Proposal job is not accessible: ${jobId}`);
    this.name = "ProposalJobAccessDeniedError";
  }
}

export class ProposalService {
  constructor(
    private readonly customerAnalysisService: CustomerAnalysisService,
    private readonly jobStore: ProposalJobStoreService,
    private readonly auditLog: ProposalAuditLogService,
    private readonly draftProvider: ProposalDraftProvider
  ) {}

  async generate(request: ProposalGenerationRequest): Promise<ProposalJob> {
    const job = this.jobStore.create(normalizeRequest(request));
    this.scheduleJob(job.jobId, request.user);
    return job;
  }

  getJob(jobId: string): ProposalJob | undefined {
    return this.jobStore.get(jobId);
  }

  getJobOrThrow(jobId: string): ProposalJob {
    const job = this.getJob(jobId);
    if (!job) {
      throw new ProposalJobNotFoundError(jobId);
    }

    return job;
  }

  getJobForUser(jobId: string, actor: AuthenticatedUser): ProposalJob {
    const job = this.getJobOrThrow(jobId);
    assertCanAccessJob(job, actor);
    return job;
  }

  listJobsForUser(actor: AuthenticatedUser): ProposalJob[] {
    return this.jobStore
      .list()
      .filter((job) => canAccessJob(job, actor))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  listLibrary(actor: AuthenticatedUser): ProposalLibraryItem[] {
    const completedJobs = this.jobStore
      .list()
      .filter((job) => job.status === "completed" && job.draft);
    const generated = completedJobs
      .filter((job) => canAccessJob(job, actor))
      .map((job) => ({
        libraryId: job.draft?.draftId ?? job.jobId,
        title: job.draft?.title ?? "Untitled proposal",
        customerName: job.draft?.customerName ?? job.request.customerId,
        status: "export_ready" as const,
        source: "generated" as const,
        formats: job.exportPackage?.formats ?? ["docx", "pptx", "xlsx"],
        tags: ["已生成", "待人工复核"],
        updatedAt: job.updatedAt
      }));

    return generated;
  }

  async retry(jobId: string, actor: AuthenticatedUser): Promise<ProposalJob> {
    const job = this.getJobForUser(jobId, actor);
    if (job.status !== "failed") {
      throw new ProposalJobRetryRejectedError(jobId);
    }

    const retried = this.jobStore.resetForRetry(jobId);
    this.scheduleJob(jobId, actor);
    return retried ?? this.getJobOrThrow(jobId);
  }

  private scheduleJob(jobId: string, actor?: AuthenticatedUser): void {
    setTimeout(() => {
      void this.runJob(jobId, actor).catch(() => this.failUnexpectedJob(jobId));
    }, 0);
  }

  private async runJob(jobId: string, actor?: AuthenticatedUser): Promise<ProposalJob> {
    const job = this.getJobOrThrow(jobId);
    const userId = job.request.userId?.trim() || "anonymous-v0";
    this.auditLog.record({
      event: "proposal_generation_started",
      jobId,
      customerId: job.request.customerId,
      userId,
      citationCount: 0
    });

    let analysis: CustomerAnalysisResult;
    try {
      this.appendProgress(jobId, "customer_analysis", "running", "Customer analysis started");
      analysis = await this.customerAnalysisService.analyze({
        customerId: job.request.customerId,
        userId: job.request.userId,
        user: actor
      });
      this.appendProgress(jobId, "customer_analysis", "completed", "Customer analysis completed");
    } catch {
      return this.failJob(jobId, job, userId, "CUSTOMER_ANALYSIS_FAILED");
    }

    let draft: ProposalDraft;
    try {
      draft = await this.draftProvider.generateDraft({ analysis, request: job.request });
      this.appendProgress(jobId, "draft_created", "completed", "Proposal draft created");
    } catch {
      return this.failJob(jobId, job, userId, "PROPOSAL_DRAFT_FAILED");
    }

    const exportPackage = buildExportPackage(analysis, draft);
    this.appendProgress(jobId, "export_package_ready", "completed", "Export package is ready");

    const completed = this.jobStore.complete(jobId, draft, exportPackage);
    this.auditLog.record({
      event: "proposal_generation_completed",
      jobId,
      customerId: job.request.customerId,
      userId,
      citationCount: draft.citations.length
    });
    return completed ?? this.getJobOrThrow(jobId);
  }

  private failJob(
    jobId: string,
    job: ProposalJob,
    userId: string,
    failureReason: ProposalFailureReason
  ): ProposalJob {
    const failed = this.jobStore.fail(jobId, failureReason);
    this.auditLog.record({
      event: "proposal_generation_failed",
      jobId,
      customerId: job.request.customerId,
      userId,
      citationCount: 0,
      failureReason
    });
    return failed ?? this.getJobOrThrow(jobId);
  }

  private failUnexpectedJob(jobId: string): void {
    const job = this.getJob(jobId);
    if (!job || job.status !== "running") {
      return;
    }
    const userId = job.request.userId?.trim() || "anonymous-v0";
    this.failJob(jobId, job, userId, "PROPOSAL_DRAFT_FAILED");
  }

  private appendProgress(
    jobId: string,
    step: ProposalProgressRecord["step"],
    status: ProposalProgressRecord["status"],
    message: string
  ): void {
    this.jobStore.appendProgress(jobId, {
      step,
      status,
      message,
      at: new Date().toISOString()
    });
  }
}

function assertCanAccessJob(job: ProposalJob, actor: AuthenticatedUser): void {
  if (canAccessJob(job, actor)) {
    return;
  }
  throw new ProposalJobAccessDeniedError(job.jobId);
}

function canAccessJob(job: ProposalJob, actor: AuthenticatedUser): boolean {
  return actor.role === "admin" || job.request.userId === actor.userId;
}

function normalizeRequest(request: ProposalGenerationRequest): ProposalGenerationRequest {
  return {
    customerId: request.customerId.trim(),
    userId: request.userId,
    humanInputs: request.humanInputs?.map((input) => ({
      inputId: input.inputId.trim(),
      label: input.label.trim(),
      value: input.value.trim()
    }))
  };
}

function buildExportPackage(analysis: CustomerAnalysisResult, draft: ProposalDraft): ExportPackage {
  return {
    packageId: createExportPackageId(),
    proposalDraftId: draft.draftId,
    customerId: draft.customerId,
    status: "ready_for_export",
    formats: ["docx", "pptx", "xlsx"],
    payload: {
      customerAnalysisId: analysis.analysisId,
      proposalDraft: draft
    }
  };
}

function createExportPackageId(): string {
  return createPrefixedId("export-package");
}
