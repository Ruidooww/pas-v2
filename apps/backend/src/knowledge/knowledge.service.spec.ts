import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { KnowledgeBlockService } from "./knowledge.service";
import type { CreateKnowledgeBlockRequest, KnowledgeBlock } from "./knowledge.types";

describe("KnowledgeBlockService", () => {
  it("creates a draft block for presales users", () => {
    const service = new KnowledgeBlockService(new AuditLogService());

    const block = service.createDraft(createUser("presales"), createRequest());

    expect(block).toEqual(
      expect.objectContaining({
        blockId: expect.stringMatching(/^kb-/),
        title: "IP-Guard outbound control",
        product: "IP-Guard",
        scenario: "outbound",
        status: "draft",
        version: 1,
        ownerUserId: "presales-1",
        citations: [
          expect.objectContaining({
            documentId: "doc-1",
            chunkId: "chunk-1"
          })
        ],
        tags: ["IP-Guard", "outbound"]
      })
    );
  });

  it("moves a draft through review approval into published status", () => {
    const service = new KnowledgeBlockService(new AuditLogService());
    const owner = createUser("presales");
    const admin = createUser("admin");
    const draft = service.createDraft(owner, createRequest());

    const pending = service.submitForReview(owner, draft.blockId);
    const published = service.reviewBlock(admin, pending.blockId, {
      decision: "approve",
      reviewNote: "Validated against product manual"
    });

    expect(pending.status).toBe("pending_review");
    expect(published).toEqual(
      expect.objectContaining({
        blockId: draft.blockId,
        status: "published",
        reviewerUserId: "admin-1",
        reviewNote: "Validated against product manual",
        publishedAt: expect.any(String)
      })
    );
  });

  it("rejects a pending block without publishing it", () => {
    const service = new KnowledgeBlockService(new AuditLogService());
    const draft = service.createDraft(createUser("presales"), createRequest());
    service.submitForReview(createUser("presales"), draft.blockId);

    const rejected = service.reviewBlock(createUser("admin"), draft.blockId, {
      decision: "reject",
      reviewNote: "Source citation is not specific enough"
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.publishedAt).toBeUndefined();
    expect(service.listPublishedBlocks()).toEqual([]);
  });

  it("disables a published block", () => {
    const service = new KnowledgeBlockService(new AuditLogService());
    const draft = service.createDraft(createUser("admin"), createRequest());
    service.submitForReview(createUser("admin"), draft.blockId);
    const published = service.reviewBlock(createUser("admin"), draft.blockId, { decision: "approve" });

    const disabled = service.disableBlock(createUser("admin"), published.blockId, "superseded by v2");

    expect(disabled.status).toBe("disabled");
    expect(disabled.reviewNote).toBe("superseded by v2");
    expect(service.listPublishedBlocks()).toEqual([]);
  });

  it("enforces role and ownership boundaries", () => {
    const service = new KnowledgeBlockService(new AuditLogService());
    const owner = createUser("presales");
    const otherPresales = createUser("presales", "presales-2");
    const draft = service.createDraft(owner, createRequest());

    expect(() => service.createDraft(createUser("sales"), createRequest())).toThrow(ForbiddenException);
    expect(() => service.submitForReview(otherPresales, draft.blockId)).toThrow(ForbiddenException);
    expect(() => service.reviewBlock(owner, draft.blockId, { decision: "approve" })).toThrow(ForbiddenException);
    expect(() => service.disableBlock(owner, draft.blockId)).toThrow(ForbiddenException);
  });

  it("rejects invalid lifecycle transitions", () => {
    const service = new KnowledgeBlockService(new AuditLogService());
    const draft = service.createDraft(createUser("admin"), createRequest());

    expect(() => service.reviewBlock(createUser("admin"), draft.blockId, { decision: "approve" })).toThrow(
      BadRequestException
    );
    expect(() => service.getBlock(createUser("admin"), "missing-block")).toThrow(NotFoundException);
  });

  it("lists only currently published blocks for deterministic generation fill", () => {
    const service = new KnowledgeBlockService(new AuditLogService());
    const published = createBlock("published-1", "published");
    service.seed([
      createBlock("draft-1", "draft"),
      createBlock("pending-1", "pending_review"),
      createBlock("rejected-1", "rejected"),
      createBlock("disabled-1", "disabled"),
      createBlock("expired-1", "expired"),
      published
    ]);

    expect(service.listPublishedBlocks()).toEqual([published]);
    expect(service.listBlocks(createUser("sales"), { publishedOnly: true })).toEqual([published]);
  });
});

function createRequest(): CreateKnowledgeBlockRequest {
  return {
    title: "IP-Guard outbound control",
    product: "IP-Guard",
    scenario: "outbound",
    body: "IP-Guard can audit and control outbound files with approval evidence.",
    citations: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "IP-Guard manual",
        source: "manual.pdf",
        score: 0.91,
        page: 7,
        section: "Outbound control"
      }
    ],
    tags: ["IP-Guard", "outbound"],
    source: {
      type: "ragflow_chunk",
      referenceId: "chunk-1"
    }
  };
}

function createBlock(blockId: string, status: KnowledgeBlock["status"]): KnowledgeBlock {
  return {
    ...createRequest(),
    blockId,
    status,
    version: 1,
    ownerUserId: "admin-1",
    reviewerUserId: status === "published" ? "admin-1" : undefined,
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    publishedAt: status === "published" ? "2026-07-05T00:00:00.000Z" : undefined
  };
}

function createUser(role: AuthenticatedUser["role"], userId = `${role}-1`): AuthenticatedUser {
  return {
    userId,
    username: `${userId}@example.com`,
    displayName: userId,
    role
  };
}
