import type { ExportFormatRecord, ExportJob, ExportJobStatus } from "./export.types";

export class ExportJobStoreService {
  private readonly jobs = new Map<string, ExportJob>();

  create(sourcePackageId: string, customerId: string): ExportJob {
    const now = new Date().toISOString();
    const job: ExportJob = {
      jobId: createJobId(),
      sourcePackageId,
      customerId,
      status: "failed",
      formats: [],
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.jobId, job);
    return cloneJob(job);
  }

  get(jobId: string): ExportJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? cloneJob(job) : undefined;
  }

  appendFormat(jobId: string, record: ExportFormatRecord): ExportJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    const updated: ExportJob = {
      ...job,
      formats: [...job.formats, record],
      updatedAt: new Date().toISOString()
    };
    this.jobs.set(jobId, updated);
    return cloneJob(updated);
  }

  finish(jobId: string): ExportJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    const status = calculateStatus(job.formats);
    const updated: ExportJob = {
      ...job,
      status,
      updatedAt: new Date().toISOString()
    };
    this.jobs.set(jobId, updated);
    return cloneJob(updated);
  }
}

function calculateStatus(records: ExportFormatRecord[]): ExportJobStatus {
  const completedCount = records.filter((record) => record.status === "completed").length;
  if (completedCount === records.length && records.length > 0) {
    return "completed";
  }

  return completedCount > 0 ? "partial" : "failed";
}

function cloneJob(job: ExportJob): ExportJob {
  return {
    ...job,
    formats: [...job.formats]
  };
}

function createJobId(): string {
  return `export-job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
