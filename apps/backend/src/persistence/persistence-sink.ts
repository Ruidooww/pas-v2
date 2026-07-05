import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { AuditEvent } from "../audit/audit.types";
import type { UserRecord } from "../auth/auth.types";
import type { ExportJob } from "../export/export.types";
import type { ExportTemplate } from "../export/export-template.types";
import type { FeedbackRecord } from "../feedback/feedback.types";
import type { KnowledgeBlock, KnowledgeDocument } from "../knowledge/knowledge.types";
import type { ProposalJob } from "../proposal/proposal.types";

// V0 persistence strategy: the synchronous in-memory stores stay the hot
// path; every mutation is mirrored here asynchronously and the stores are
// hydrated from these tables at boot. Mirror failures are logged, never
// thrown — persistence must not block the business flow. V1 replaces the
// hot path with full repositories.
export class PersistenceSink {
  private readonly logger = new Logger(PersistenceSink.name);
  private readonly client?: PrismaClient;

  constructor(databaseUrl: string | undefined = process.env.DATABASE_URL) {
    if (databaseUrl?.trim()) {
      // Lazy CJS require: the generated client only loads when persistence is
      // enabled, so unit tests (sink disabled) never touch @prisma/client.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient: PrismaClientCtor } = require("@prisma/client") as {
        PrismaClient: new () => PrismaClient;
      };
      this.client = new PrismaClientCtor();
    }
  }

  get enabled(): boolean {
    return this.client !== undefined;
  }

  mirrorUser(user: UserRecord): void {
    if (!this.client) return;
    const data = {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      passwordHash: user.passwordHash,
      active: user.active,
      createdAt: new Date(user.createdAt)
    };
    this.client.user
      .upsert({ where: { id: user.userId }, create: { id: user.userId, ...data }, update: data })
      .catch((error) => this.logMirrorFailure("user", user.userId, error));
  }

  async loadUsers(): Promise<UserRecord[]> {
    if (!this.client) return [];
    const rows = await this.client.user.findMany();
    return rows.map((row) => ({
      userId: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role as UserRecord["role"],
      passwordHash: row.passwordHash,
      active: row.active,
      createdAt: row.createdAt.toISOString()
    }));
  }

  mirrorAudit(event: AuditEvent): void {
    if (!this.client) return;
    this.client.auditEvent
      .create({
        data: {
          auditId: event.auditId,
          event: event.action,
          payload: event as unknown as object,
          occurredAt: new Date(event.occurredAt)
        }
      })
      .catch((error) => this.logMirrorFailure("audit", event.auditId, error));
  }

  async loadAuditEvents(limit = 1000): Promise<AuditEvent[]> {
    if (!this.client) return [];
    const rows = await this.client.auditEvent.findMany({
      orderBy: { occurredAt: "asc" },
      take: limit
    });
    return rows.map((row) => row.payload as unknown as AuditEvent);
  }

  mirrorProposalJob(job: ProposalJob): void {
    if (!this.client) return;
    const data = {
      userId: job.request.userId ?? null,
      customerId: job.request.customerId,
      status: job.status,
      data: job as unknown as object,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt)
    };
    this.client.proposalJobSnapshot
      .upsert({ where: { jobId: job.jobId }, create: { jobId: job.jobId, ...data }, update: data })
      .catch((error) => this.logMirrorFailure("proposal_job", job.jobId, error));
  }

  async loadProposalJobs(): Promise<ProposalJob[]> {
    if (!this.client) return [];
    const rows = await this.client.proposalJobSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as ProposalJob);
  }

  mirrorExportJob(job: ExportJob, userId?: string): void {
    if (!this.client) return;
    const data = {
      userId: userId ?? null,
      sourcePackageId: job.sourcePackageId,
      customerId: job.customerId,
      status: job.status,
      data: job as unknown as object,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt)
    };
    this.client.exportJobSnapshot
      .upsert({ where: { jobId: job.jobId }, create: { jobId: job.jobId, ...data }, update: data })
      .catch((error) => this.logMirrorFailure("export_job", job.jobId, error));
  }

  async loadExportJobs(): Promise<ExportJob[]> {
    if (!this.client) return [];
    const rows = await this.client.exportJobSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as ExportJob);
  }

  mirrorExportTemplate(template: ExportTemplate): void {
    if (!this.client) return;
    const data = {
      ownerUserId: template.ownerUserId,
      format: template.format,
      status: template.status,
      data: template as unknown as object,
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt)
    };
    this.client.exportTemplateSnapshot
      .upsert({
        where: { templateId: template.templateId },
        create: { templateId: template.templateId, ...data },
        update: data
      })
      .catch((error) => this.logMirrorFailure("export_template", template.templateId, error));
  }

  async loadExportTemplates(): Promise<ExportTemplate[]> {
    if (!this.client) return [];
    const rows = await this.client.exportTemplateSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as ExportTemplate);
  }

  mirrorFeedback(record: FeedbackRecord): void {
    if (!this.client) return;
    const data = {
      userId: record.createdBy,
      status: record.status,
      data: record as unknown as object,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.handledAt || record.createdAt)
    };
    this.client.feedbackSnapshot
      .upsert({
        where: { feedbackId: record.feedbackId },
        create: { feedbackId: record.feedbackId, ...data },
        update: data
      })
      .catch((error) => this.logMirrorFailure("feedback", record.feedbackId, error));
  }

  async loadFeedback(): Promise<FeedbackRecord[]> {
    if (!this.client) return [];
    const rows = await this.client.feedbackSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as FeedbackRecord);
  }

  mirrorKnowledgeBlock(block: KnowledgeBlock): void {
    if (!this.client) return;
    const data = {
      ownerUserId: block.ownerUserId,
      status: block.status,
      data: block as unknown as object,
      createdAt: new Date(block.createdAt),
      updatedAt: new Date(block.updatedAt)
    };
    this.client.knowledgeBlockSnapshot
      .upsert({
        where: { blockId: block.blockId },
        create: { blockId: block.blockId, ...data },
        update: data
      })
      .catch((error) => this.logMirrorFailure("knowledge_block", block.blockId, error));
  }

  async loadKnowledgeBlocks(): Promise<KnowledgeBlock[]> {
    if (!this.client) return [];
    const rows = await this.client.knowledgeBlockSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as KnowledgeBlock);
  }

  mirrorKnowledgeDocument(document: KnowledgeDocument): void {
    if (!this.client) return;
    const data = {
      ownerUserId: document.ownerUserId,
      parseStatus: document.parseStatus,
      enabled: document.enabled,
      data: document as unknown as object,
      createdAt: new Date(document.createdAt),
      updatedAt: new Date(document.updatedAt)
    };
    this.client.knowledgeDocumentSnapshot
      .upsert({
        where: { documentId: document.documentId },
        create: { documentId: document.documentId, ...data },
        update: data
      })
      .catch((error) => this.logMirrorFailure("knowledge_document", document.documentId, error));
  }

  async loadKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
    if (!this.client) return [];
    const rows = await this.client.knowledgeDocumentSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as KnowledgeDocument);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }

  private logMirrorFailure(kind: string, id: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`persistence mirror failed: ${kind}/${id}: ${message}`);
  }
}
