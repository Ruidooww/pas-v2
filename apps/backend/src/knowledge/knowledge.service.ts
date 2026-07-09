import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { createPrefixedId } from "../ids";
import type { PersistenceSink } from "../persistence/persistence-sink";
import type {
  CreateKnowledgeBlockRequest,
  KnowledgeBlock,
  KnowledgeBlockListFilter,
  ReviewKnowledgeBlockRequest
} from "./knowledge.types";

export class KnowledgeBlockService {
  private readonly blocks = new Map<string, KnowledgeBlock>();

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly sink?: PersistenceSink
  ) {}

  seed(blocks: KnowledgeBlock[]): void {
    for (const block of blocks) {
      if (!this.blocks.has(block.blockId)) {
        this.blocks.set(block.blockId, cloneBlock(block));
      }
    }
  }

  createDraft(user: AuthenticatedUser, request: CreateKnowledgeBlockRequest): KnowledgeBlock {
    assertCanCreate(user);
    const now = nowIso();
    const block: KnowledgeBlock = {
      ...normalizeRequest(request),
      blockId: createBlockId(),
      status: "draft",
      version: 1,
      ownerUserId: user.userId,
      createdAt: now,
      updatedAt: now
    };
    this.save(user, block, "knowledge_block_created");
    return cloneBlock(block);
  }

  listBlocks(user: AuthenticatedUser, filter: KnowledgeBlockListFilter = {}): KnowledgeBlock[] {
    if (filter.publishedOnly || user.role === "sales") {
      return this.listPublishedBlocks();
    }

    return [...this.blocks.values()]
      .filter((block) => (filter.status ? block.status === filter.status : true))
      .map(cloneBlock);
  }

  listPublishedBlocks(): KnowledgeBlock[] {
    const now = Date.now();
    return [...this.blocks.values()]
      .filter((block) => block.status === "published")
      .filter((block) => !block.expiresAt || Date.parse(block.expiresAt) > now)
      .map(cloneBlock);
  }

  getBlock(user: AuthenticatedUser, blockId: string): KnowledgeBlock {
    const block = this.blocks.get(blockId);
    if (!block) {
      throw new NotFoundException("knowledge block not found");
    }
    if (user.role === "sales" && block.status !== "published") {
      throw new ForbiddenException("published knowledge block is required");
    }
    return cloneBlock(block);
  }

  submitForReview(user: AuthenticatedUser, blockId: string): KnowledgeBlock {
    const block = this.getExistingBlock(blockId);
    assertOwnerOrAdmin(user, block);
    if (block.status !== "draft" && block.status !== "rejected") {
      throw new BadRequestException("only draft or rejected knowledge blocks can be submitted for review");
    }

    const updated: KnowledgeBlock = {
      ...block,
      status: "pending_review",
      updatedAt: nowIso(),
      reviewNote: undefined
    };
    this.save(user, updated, "knowledge_block_review_requested");
    return cloneBlock(updated);
  }

  reviewBlock(
    user: AuthenticatedUser,
    blockId: string,
    request: ReviewKnowledgeBlockRequest
  ): KnowledgeBlock {
    assertAdmin(user);
    const block = this.getExistingBlock(blockId);
    if (block.status !== "pending_review") {
      throw new BadRequestException("only pending review knowledge blocks can be reviewed");
    }

    const now = nowIso();
    const updated: KnowledgeBlock =
      request.decision === "approve"
        ? {
            ...block,
            status: "published",
            reviewerUserId: user.userId,
            reviewNote: request.reviewNote,
            publishedAt: now,
            updatedAt: now
          }
        : {
            ...block,
            status: "rejected",
            reviewerUserId: user.userId,
            reviewNote: request.reviewNote,
            publishedAt: undefined,
            updatedAt: now
          };
    this.save(user, updated, `knowledge_block_${updated.status}`);
    return cloneBlock(updated);
  }

  disableBlock(user: AuthenticatedUser, blockId: string, reviewNote?: string): KnowledgeBlock {
    assertAdmin(user);
    const block = this.getExistingBlock(blockId);
    if (block.status !== "published") {
      throw new BadRequestException("only published knowledge blocks can be disabled");
    }

    const updated: KnowledgeBlock = {
      ...block,
      status: "disabled",
      reviewNote,
      updatedAt: nowIso()
    };
    this.save(user, updated, "knowledge_block_disabled");
    return cloneBlock(updated);
  }

  private getExistingBlock(blockId: string): KnowledgeBlock {
    const block = this.blocks.get(blockId);
    if (!block) {
      throw new NotFoundException("knowledge block not found");
    }
    return block;
  }

  private save(user: AuthenticatedUser, block: KnowledgeBlock, reason: string): void {
    this.blocks.set(block.blockId, cloneBlock(block));
    this.sink?.mirrorKnowledgeBlock(block);
    this.auditLog.record({
      action: "knowledge",
      actorUserId: user.userId,
      objectType: "knowledge_block",
      objectId: block.blockId,
      result: "success",
      failureReason: reason
    });
  }
}

function normalizeRequest(request: CreateKnowledgeBlockRequest): CreateKnowledgeBlockRequest {
  const title = request.title.trim();
  const product = request.product.trim();
  const scenario = request.scenario.trim();
  const body = request.body.trim();
  if (!title || !product || !scenario || !body) {
    throw new BadRequestException("title, product, scenario, and body are required");
  }

  return {
    title,
    product,
    scenario,
    body,
    citations: request.citations ? request.citations.map((citation) => ({ ...citation })) : [],
    tags: request.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
    source: request.source ? { ...request.source } : { type: "manual" },
    expiresAt: request.expiresAt
  };
}

function assertCanCreate(user: AuthenticatedUser): void {
  if (user.role !== "admin" && user.role !== "presales") {
    throw new ForbiddenException("admin or presales role is required");
  }
}

function assertAdmin(user: AuthenticatedUser): void {
  if (user.role !== "admin") {
    throw new ForbiddenException("admin role is required");
  }
}

function assertOwnerOrAdmin(user: AuthenticatedUser, block: KnowledgeBlock): void {
  if (user.role === "admin" || block.ownerUserId === user.userId) {
    return;
  }
  throw new ForbiddenException("knowledge block owner or admin role is required");
}

function cloneBlock(block: KnowledgeBlock): KnowledgeBlock {
  return {
    ...block,
    citations: block.citations?.map((citation) => ({ ...citation })) ?? [],
    tags: block.tags ? [...block.tags] : [],
    source: block.source ? { ...block.source } : undefined
  };
}

function createBlockId(): string {
  return createPrefixedId("kb");
}

function nowIso(): string {
  return new Date().toISOString();
}
