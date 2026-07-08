import { Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { AuditEvent } from "../audit/audit.types";
import type { UserRecord } from "../auth/auth.types";
import type { BusinessFlowRecord } from "../business-flow/business-flow.types";
import type { ExportJob } from "../export/export.types";
import type { ExportTemplate } from "../export/export-template.types";
import type { FeedbackRecord, RegressionRun } from "../feedback/feedback.types";
import type { KnowledgeBlock, KnowledgeDocument } from "../knowledge/knowledge.types";
import type { MenuState } from "../menu/menu.types";
import type { PlatformState } from "../platform/platform.types";
import type { ProposalJob } from "../proposal/proposal.types";

// V0 persistence strategy: the synchronous in-memory stores stay the hot
// path; every mutation is mirrored here asynchronously and the stores are
// hydrated from these tables at boot. Mirror failures are logged, never
// thrown — persistence must not block the business flow. V1 replaces the
// hot path with full repositories.
export class PersistenceSink implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PersistenceSink.name);
  private readonly client?: PrismaClient;
  private mirrorQueue: Promise<void> = Promise.resolve();

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

  async onModuleInit(): Promise<void> {
    await this.client?.$connect();
  }

  mirrorUser(user: UserRecord): void {
    const client = this.client;
    if (!client) return;
    const data = {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      passwordHash: user.passwordHash,
      active: user.active,
      createdAt: new Date(user.createdAt)
    };
    this.enqueueMirror("user", user.userId, () =>
      client.user.upsert({ where: { id: user.userId }, create: { id: user.userId, ...data }, update: data })
    );
  }

  async loadUsers(limit = 1000): Promise<UserRecord[]> {
    if (!this.client) return [];
    const rows = await this.client.user.findMany({
      orderBy: { createdAt: "asc" },
      take: limit
    });
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
    const client = this.client;
    if (!client) return;
    this.enqueueMirror("audit", event.auditId, () =>
      client.auditEvent.create({
        data: {
          auditId: event.auditId,
          event: event.action,
          payload: event as unknown as object,
          occurredAt: new Date(event.occurredAt)
        }
      })
    );
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
    const client = this.client;
    if (!client) return;
    const data = {
      userId: job.request.userId ?? null,
      customerId: job.request.customerId,
      status: job.status,
      data: job as unknown as object,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt)
    };
    this.enqueueMirror("proposal_job", job.jobId, () =>
      client.proposalJobSnapshot.upsert({ where: { jobId: job.jobId }, create: { jobId: job.jobId, ...data }, update: data })
    );
  }

  async loadProposalJobs(): Promise<ProposalJob[]> {
    if (!this.client) return [];
    const rows = await this.client.proposalJobSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as ProposalJob);
  }

  mirrorExportJob(job: ExportJob, userId?: string): void {
    const client = this.client;
    if (!client) return;
    const data = {
      userId: userId ?? null,
      sourcePackageId: job.sourcePackageId,
      customerId: job.customerId,
      status: job.status,
      data: job as unknown as object,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt)
    };
    this.enqueueMirror("export_job", job.jobId, () =>
      client.exportJobSnapshot.upsert({ where: { jobId: job.jobId }, create: { jobId: job.jobId, ...data }, update: data })
    );
  }

  async loadExportJobs(): Promise<ExportJob[]> {
    if (!this.client) return [];
    const rows = await this.client.exportJobSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as ExportJob);
  }

  mirrorExportTemplate(template: ExportTemplate): void {
    const client = this.client;
    if (!client) return;
    const data = {
      ownerUserId: template.ownerUserId,
      format: template.format,
      status: template.status,
      data: template as unknown as object,
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt)
    };
    this.enqueueMirror("export_template", template.templateId, () =>
      client.exportTemplateSnapshot.upsert({
        where: { templateId: template.templateId },
        create: { templateId: template.templateId, ...data },
        update: data
      })
    );
  }

  async loadExportTemplates(): Promise<ExportTemplate[]> {
    if (!this.client) return [];
    const rows = await this.client.exportTemplateSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as ExportTemplate);
  }

  mirrorFeedback(record: FeedbackRecord): void {
    const client = this.client;
    if (!client) return;
    const data = {
      userId: record.createdBy,
      status: record.status,
      data: record as unknown as object,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.handledAt || record.createdAt)
    };
    this.enqueueMirror("feedback", record.feedbackId, () =>
      client.feedbackSnapshot.upsert({
        where: { feedbackId: record.feedbackId },
        create: { feedbackId: record.feedbackId, ...data },
        update: data
      })
    );
  }

  async loadFeedback(): Promise<FeedbackRecord[]> {
    if (!this.client) return [];
    const rows = await this.client.feedbackSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as FeedbackRecord);
  }

  mirrorRegressionRun(run: RegressionRun): void {
    const client = this.client;
    if (!client) return;
    const data = {
      createdBy: run.createdBy,
      gateStatus: run.gateStatus,
      canGoLive: run.canGoLive,
      data: run as unknown as object,
      createdAt: new Date(run.createdAt)
    };
    this.enqueueMirror("regression_run", run.runId, () =>
      client.regressionRunSnapshot.upsert({
        where: { runId: run.runId },
        create: { runId: run.runId, ...data },
        update: data
      })
    );
  }

  async loadRegressionRuns(): Promise<RegressionRun[]> {
    if (!this.client) return [];
    const rows = await this.client.regressionRunSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as RegressionRun);
  }

  mirrorKnowledgeBlock(block: KnowledgeBlock): void {
    const client = this.client;
    if (!client) return;
    const data = {
      ownerUserId: block.ownerUserId,
      status: block.status,
      data: block as unknown as object,
      createdAt: new Date(block.createdAt),
      updatedAt: new Date(block.updatedAt)
    };
    this.enqueueMirror("knowledge_block", block.blockId, () =>
      client.knowledgeBlockSnapshot.upsert({
        where: { blockId: block.blockId },
        create: { blockId: block.blockId, ...data },
        update: data
      })
    );
  }

  async loadKnowledgeBlocks(): Promise<KnowledgeBlock[]> {
    if (!this.client) return [];
    const rows = await this.client.knowledgeBlockSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as KnowledgeBlock);
  }

  mirrorKnowledgeDocument(document: KnowledgeDocument): void {
    const client = this.client;
    if (!client) return;
    const data = {
      ownerUserId: document.ownerUserId,
      parseStatus: document.parseStatus,
      enabled: document.enabled,
      data: document as unknown as object,
      createdAt: new Date(document.createdAt),
      updatedAt: new Date(document.updatedAt)
    };
    this.enqueueMirror("knowledge_document", document.documentId, () =>
      client.knowledgeDocumentSnapshot.upsert({
        where: { documentId: document.documentId },
        create: { documentId: document.documentId, ...data },
        update: data
      })
    );
  }

  async loadKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
    if (!this.client) return [];
    const rows = await this.client.knowledgeDocumentSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as KnowledgeDocument);
  }

  mirrorBusinessFlowRecord(record: BusinessFlowRecord): void {
    const client = this.client;
    if (!client) return;
    const data = {
      ownerUserId: record.ownerUserId,
      kind: record.kind,
      status: record.status,
      sourceSystem: record.source.system,
      data: record as unknown as object,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt)
    };
    this.enqueueMirror("business_flow_record", record.recordId, () =>
      client.businessFlowRecordSnapshot.upsert({
        where: { recordId: record.recordId },
        create: { recordId: record.recordId, ...data },
        update: data
      })
    );
  }

  async loadBusinessFlowRecords(): Promise<BusinessFlowRecord[]> {
    if (!this.client) return [];
    const rows = await this.client.businessFlowRecordSnapshot.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => row.data as unknown as BusinessFlowRecord);
  }

  mirrorPlatformState(state: PlatformState): void {
    const client = this.client;
    if (!client) return;
    const data = {
      data: state as unknown as object,
      updatedAt: new Date(state.updatedAt)
    };
    this.enqueueMirror("platform_state", state.stateId, () =>
      client.platformStateSnapshot.upsert({
        where: { snapshotId: state.stateId },
        create: { snapshotId: state.stateId, ...data },
        update: data
      })
    );
  }

  async loadPlatformState(): Promise<PlatformState | undefined> {
    if (!this.client) return undefined;
    const row = await this.client.platformStateSnapshot.findFirst({ orderBy: { updatedAt: "desc" } });
    return row ? (row.data as unknown as PlatformState) : undefined;
  }

  mirrorMenuState(state: MenuState): void {
    const client = this.client;
    if (!client) return;
    const data = {
      data: state as unknown as object,
      updatedAt: new Date(state.updatedAt)
    };
    this.enqueueMirror("menu_state", state.stateId, () =>
      client.menuStateSnapshot.upsert({
        where: { snapshotId: state.stateId },
        create: { snapshotId: state.stateId, ...data },
        update: data
      })
    );
  }

  async loadMenuState(): Promise<MenuState | undefined> {
    if (!this.client) return undefined;
    const row = await this.client.menuStateSnapshot.findFirst({ orderBy: { updatedAt: "desc" } });
    return row ? (row.data as unknown as MenuState) : undefined;
  }

  async onModuleDestroy(): Promise<void> {
    await this.mirrorQueue;
    await this.client?.$disconnect();
  }

  private enqueueMirror(kind: string, id: string, operation: () => Promise<unknown>): void {
    const run = async (): Promise<void> => {
      try {
        await operation();
      } catch (error) {
        this.logMirrorFailure(kind, id, error);
      }
    };

    this.mirrorQueue = this.mirrorQueue.then(run, run);
  }

  private logMirrorFailure(kind: string, id: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`persistence mirror failed: ${kind}/${id}: ${message}`);
  }
}
