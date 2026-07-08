import { describe, expect, it, vi } from "vitest";
import type { BusinessFlowRecord } from "../business-flow/business-flow.types";
import type { RegressionRun } from "../feedback/feedback.types";
import type { KnowledgeBlock, KnowledgeDocument } from "../knowledge/knowledge.types";
import { PersistenceSink } from "./persistence-sink";

describe("PersistenceSink", () => {
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
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
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
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
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
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
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
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
  });
});

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
