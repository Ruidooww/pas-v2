import type { PersistenceSink } from "../persistence/persistence-sink";
import type {
  ExportPackage,
  ProposalDraft,
  ProposalFailureReason,
  ProposalGenerationRequest,
  ProposalJob,
  ProposalProgressRecord
} from "./proposal.types";

export class ProposalJobStoreService {
  private readonly jobs = new Map<string, ProposalJob>();

  constructor(private readonly sink?: PersistenceSink) {}

  seed(jobs: ProposalJob[]): void {
    for (const job of jobs) {
      if (!this.jobs.has(job.jobId)) this.jobs.set(job.jobId, job);
    }
  }

  create(request: ProposalGenerationRequest): ProposalJob {
    const now = nowIso();
    const job: ProposalJob = {
      jobId: createJobId(),
      status: "running",
      request,
      progress: [
        {
          step: "accepted",
          status: "completed",
          message: "Proposal generation request accepted",
          at: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.jobId, job);
    this.sink?.mirrorProposalJob(job);
    return cloneJob(job);
  }

  get(jobId: string): ProposalJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? cloneJob(job) : undefined;
  }

  resetForRetry(jobId: string): ProposalJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    const now = nowIso();
    const retried: ProposalJob = {
      jobId: job.jobId,
      status: "running",
      request: job.request,
      progress: [
        {
          step: "accepted",
          status: "completed",
          message: "Proposal generation retry accepted",
          at: now
        }
      ],
      createdAt: job.createdAt,
      updatedAt: now
    };
    this.jobs.set(jobId, retried);
    this.sink?.mirrorProposalJob(retried);
    return cloneJob(retried);
  }

  appendProgress(jobId: string, record: ProposalProgressRecord): ProposalJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    const updated: ProposalJob = {
      ...job,
      progress: [...job.progress, record],
      updatedAt: record.at
    };
    this.jobs.set(jobId, updated);
    this.sink?.mirrorProposalJob(updated);
    return cloneJob(updated);
  }

  complete(jobId: string, draft: ProposalDraft, exportPackage: ExportPackage): ProposalJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    const now = nowIso();
    const completed: ProposalJob = {
      ...job,
      status: "completed",
      draft,
      exportPackage,
      failureReason: undefined,
      updatedAt: now
    };
    this.jobs.set(jobId, completed);
    this.sink?.mirrorProposalJob(completed);
    return cloneJob(completed);
  }

  fail(jobId: string, failureReason: ProposalFailureReason): ProposalJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    const now = nowIso();
    const failed: ProposalJob = {
      jobId: job.jobId,
      status: "failed",
      request: job.request,
      progress: [
        ...job.progress,
        {
          step: "failed",
          status: "failed",
          message: failureReason,
          at: now
        }
      ],
      createdAt: job.createdAt,
      updatedAt: now,
      failureReason
    };
    this.jobs.set(jobId, failed);
    this.sink?.mirrorProposalJob(failed);
    return cloneJob(failed);
  }
}

function cloneJob(job: ProposalJob): ProposalJob {
  return {
    ...job,
    request: {
      ...job.request,
      humanInputs: job.request.humanInputs ? [...job.request.humanInputs] : undefined
    },
    progress: [...job.progress],
    draft: job.draft
      ? {
          ...job.draft,
          sections: job.draft.sections.map((section) => ({
            ...section,
            traces: [...section.traces]
          })),
          citations: [...job.draft.citations],
          assumptions: [...job.draft.assumptions]
        }
      : undefined,
    exportPackage: job.exportPackage
      ? {
          ...job.exportPackage,
          formats: [...job.exportPackage.formats],
          payload: {
            ...job.exportPackage.payload
          }
        }
      : undefined
  };
}

function createJobId(): string {
  return `proposal-job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}
