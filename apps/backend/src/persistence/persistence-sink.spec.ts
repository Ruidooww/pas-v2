import { describe, expect, it, vi } from "vitest";
import type { AuditEvent } from "../audit/audit.types";
import type { BusinessFlowRecord } from "../business-flow/business-flow.types";
import type { RegressionRun } from "../feedback/feedback.types";
import type { KnowledgeBlock, KnowledgeDocument } from "../knowledge/knowledge.types";
import { createDefaultOrganizationState } from "../organization/organization.types";
import { PersistenceSink } from "./persistence-sink";

describe("PersistenceSink", () => {
  it("connects the Prisma client during module initialization", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        $connect: connect
      }
    });

    await (sink as unknown as { onModuleInit(): Promise<void> }).onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("limits hydrated users by default", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        user: {
          findMany
        }
      }
    });

    await expect(sink.loadUsers()).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      take: 1000
    });
  });

  it("limits hydrated proposal job snapshots by default", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        proposalJobSnapshot: {
          findMany
        }
      }
    });

    await expect(sink.loadProposalJobs()).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      take: 1000
    });
  });

  it("queues mirror writes instead of running them concurrently", async () => {
    const first = deferred<void>();
    const upsert = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        knowledgeBlockSnapshot: {
          upsert
        }
      }
    });

    sink.mirrorKnowledgeBlock(createBlock());
    sink.mirrorKnowledgeBlock({ ...createBlock(), blockId: "kb-2" });
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledTimes(1);

    first.resolve();
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("batches synchronous audit mirror writes", async () => {
    const first = createAuditEvent("audit-1");
    const second = createAuditEvent("audit-2");
    const create = vi.fn().mockResolvedValue(undefined);
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        auditEvent: {
          create,
          createMany
        }
      }
    });

    sink.mirrorAudit(first);
    sink.mirrorAudit(second);
    await flushMicrotasks();

    expect(create).not.toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          auditId: first.auditId,
          event: first.action,
          payload: first,
          occurredAt: new Date(first.occurredAt)
        },
        {
          auditId: second.auditId,
          event: second.action,
          payload: second,
          occurredAt: new Date(second.occurredAt)
        }
      ],
      skipDuplicates: true
    });
  });

  it("mirrors and loads knowledge block snapshots", async () => {
    const block = createBlock();
    const upsert = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn().mockResolvedValue([{ data: block }]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        knowledgeBlockSnapshot: {
          upsert,
          findMany
        }
      }
    });

    sink.mirrorKnowledgeBlock(block);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      where: { blockId: "kb-1" },
      create: {
        blockId: "kb-1",
        ownerUserId: "admin-1",
        status: "published",
        data: block,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      },
      update: {
        ownerUserId: "admin-1",
        status: "published",
        data: block,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }
    });
    await expect(sink.loadKnowledgeBlocks()).resolves.toEqual([block]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" }, take: 1000 });
  });

  it("mirrors and loads knowledge document snapshots", async () => {
    const document = createDocument();
    const upsert = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn().mockResolvedValue([{ data: document }]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        knowledgeDocumentSnapshot: {
          upsert,
          findMany
        }
      }
    });

    sink.mirrorKnowledgeDocument(document);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      where: { documentId: "doc-1" },
      create: {
        documentId: "doc-1",
        ownerUserId: "admin-1",
        parseStatus: "done",
        enabled: true,
        data: document,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      },
      update: {
        ownerUserId: "admin-1",
        parseStatus: "done",
        enabled: true,
        data: document,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }
    });
    await expect(sink.loadKnowledgeDocuments()).resolves.toEqual([document]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" }, take: 1000 });
  });

  it("mirrors and loads V2 business flow record snapshots", async () => {
    const record = createBusinessFlowRecord();
    const upsert = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn().mockResolvedValue([{ data: record }]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        businessFlowRecordSnapshot: {
          upsert,
          findMany
        }
      }
    });

    sink.mirrorBusinessFlowRecord(record);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      where: { recordId: "bf-1" },
      create: {
        recordId: "bf-1",
        ownerUserId: "sales-1",
        kind: "opportunity",
        status: "pending_confirmation",
        sourceSystem: "manual_text",
        data: record,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      },
      update: {
        ownerUserId: "sales-1",
        kind: "opportunity",
        status: "pending_confirmation",
        sourceSystem: "manual_text",
        data: record,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }
    });
    await expect(sink.loadBusinessFlowRecords()).resolves.toEqual([record]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" }, take: 1000 });
  });

  it("mirrors and loads regression run snapshots", async () => {
    const run = createRegressionRun();
    const upsert = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn().mockResolvedValue([{ data: run }]);
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        regressionRunSnapshot: {
          upsert,
          findMany
        }
      }
    });

    sink.mirrorRegressionRun(run);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      where: { runId: "regression-1" },
      create: {
        runId: "regression-1",
        createdBy: "admin-1",
        gateStatus: "passed",
        canGoLive: true,
        data: run,
        createdAt: expect.any(Date)
      },
      update: {
        createdBy: "admin-1",
        gateStatus: "passed",
        canGoLive: true,
        data: run,
        createdAt: expect.any(Date)
      }
    });
    await expect(sink.loadRegressionRuns()).resolves.toEqual([run]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" }, take: 1000 });
  });

  it("mirrors and loads organization state", async () => {
    const state = createDefaultOrganizationState("2026-07-10T00:00:00.000Z");
    const upsert = vi.fn().mockResolvedValue(undefined);
    const findFirst = vi.fn().mockResolvedValue({ data: state });
    const sink = new PersistenceSink("");
    Object.defineProperty(sink, "client", {
      value: {
        organizationStateSnapshot: {
          upsert,
          findFirst
        }
      }
    });

    sink.mirrorOrganizationState(state);
    await flushMicrotasks();

    expect(upsert).toHaveBeenCalledWith({
      where: { snapshotId: "pas-organization-state" },
      create: {
        snapshotId: "pas-organization-state",
        data: state,
        updatedAt: expect.any(Date)
      },
      update: {
        data: state,
        updatedAt: expect.any(Date)
      }
    });
    await expect(sink.loadOrganizationState()).resolves.toEqual(state);
    expect(findFirst).toHaveBeenCalledWith({ orderBy: { updatedAt: "desc" } });
  });
});

function createAuditEvent(auditId: string): AuditEvent {
  return {
    auditId,
    action: "login",
    actorUserId: "admin-1",
    objectType: "session",
    objectId: "session-1",
    result: "success",
    occurredAt: "2026-07-05T00:00:00.000Z"
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void } {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createBlock(): KnowledgeBlock {
  return {
    blockId: "kb-1",
    title: "IP-Guard outbound control",
    product: "IP-Guard",
    scenario: "outbound",
    body: "IP-Guard can audit outbound files.",
    citations: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "Manual",
        source: "manual.pdf",
        score: 0.91
      }
    ],
    tags: ["IP-Guard"],
    source: { type: "ragflow_chunk", referenceId: "chunk-1" },
    status: "published",
    version: 1,
    ownerUserId: "admin-1",
    reviewerUserId: "admin-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    publishedAt: "2026-07-05T00:00:00.000Z"
  };
}

function createDocument(): KnowledgeDocument {
  return {
    documentId: "doc-1",
    title: "IP-Guard Manual",
    product: "IP-Guard",
    materialType: "pdf",
    sourceName: "manual.pdf",
    parseStatus: "done",
    enabled: true,
    chunkCount: 42,
    hitCount: 0,
    badFeedbackCount: 0,
    tags: ["IP-Guard"],
    visibility: { scope: "public" },
    ownerUserId: "admin-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}

function createBusinessFlowRecord(): BusinessFlowRecord {
  return {
    recordId: "bf-1",
    kind: "opportunity",
    status: "pending_confirmation",
    ownerUserId: "sales-1",
    ownerRole: "sales",
    source: {
      system: "manual_text",
      reference: "note-1",
      capturedAt: "2026-07-05T00:00:00.000Z"
    },
    payload: {
      title: "华信精工"
    },
    outputs: {
      opportunity: {
        customerName: "华信精工",
        demand: "终端数据防泄漏",
        stage: "proposal",
        sourceSummary: "manual text"
      }
    },
    pendingInputs: ["crm_writeback_adapter"],
    events: [
      {
        eventId: "event-1",
        type: "record_created",
        actorUserId: "sales-1",
        occurredAt: "2026-07-05T00:00:00.000Z"
      }
    ],
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}

function createRegressionRun(): RegressionRun {
  return {
    runId: "regression-1",
    name: "V0 full regression",
    owner: "QA owner",
    approver: "Business approver",
    requiredCaseCount: 50,
    cases: [
      {
        questionId: "q-1",
        question: "Question 1",
        expectedEvidence: "Evidence 1",
        passed: true
      }
    ],
    totalCases: 1,
    passedCases: 1,
    failedCases: 0,
    canGoLive: true,
    gateStatus: "passed",
    createdBy: "admin-1",
    createdAt: "2026-07-05T00:00:00.000Z"
  };
}
