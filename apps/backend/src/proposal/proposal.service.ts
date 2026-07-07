import type { AuthenticatedUser } from "../auth/auth.types";
import type { CustomerAnalysisResult } from "../customer-analysis/customer-analysis.types";
import type { CustomerAnalysisService } from "../customer-analysis/customer-analysis.service";
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
    return this.runJob(job.jobId, request.user);
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

  listLibrary(actor: AuthenticatedUser): ProposalLibraryItem[] {
    const generated = this.jobStore
      .list()
      .filter((job) => job.status === "completed" && job.draft && canAccessJob(job, actor))
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

    return [...generated, ...SAMPLE_PROPOSAL_LIBRARY];
  }

  async retry(jobId: string, actor: AuthenticatedUser): Promise<ProposalJob> {
    const job = this.getJobForUser(jobId, actor);
    if (job.status !== "failed") {
      throw new ProposalJobRetryRejectedError(jobId);
    }

    this.jobStore.resetForRetry(jobId);
    return this.runJob(jobId, actor);
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
  return `export-package-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const SAMPLE_PROPOSAL_LIBRARY: ProposalLibraryItem[] = [
  {
    libraryId: "sample-huaxin-dlp",
    title: "华信精工终端数据防泄漏建设方案",
    customerName: "华信精工",
    status: "sample",
    source: "mock",
    formats: ["docx", "pptx", "xlsx"],
    tags: ["制造业", "IP-Guard", "透明加密"],
    updatedAt: "2026-07-07T09:00:00.000Z"
  },
  {
    libraryId: "sample-finance-audit",
    title: "金融行业外发审计与终端管控方案",
    customerName: "融盛金服",
    status: "sample",
    source: "mock",
    formats: ["docx", "pptx"],
    tags: ["金融", "审计", "合规"],
    updatedAt: "2026-07-06T16:30:00.000Z"
  }
];
