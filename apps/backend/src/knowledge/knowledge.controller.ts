import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { KNOWLEDGE_BLOCK_SERVICE } from "./knowledge.tokens";
import { KnowledgeBlockService } from "./knowledge.service";
import type {
  CreateKnowledgeBlockRequest,
  KnowledgeBlock,
  KnowledgeBlockListFilter,
  KnowledgeBlockStatus,
  ReviewKnowledgeBlockRequest
} from "./knowledge.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

type KnowledgeListQuery = {
  status?: KnowledgeBlockStatus;
  publishedOnly?: string | boolean;
};

type DisableKnowledgeBlockRequest = {
  reviewNote?: string;
};

@Controller("api/internal/knowledge-blocks")
export class KnowledgeBlockController {
  constructor(@Inject(KNOWLEDGE_BLOCK_SERVICE) private readonly knowledgeBlocks: KnowledgeBlockService) {}

  @Post()
  create(@Req() request: RequestWithUser, @Body() body: CreateKnowledgeBlockRequest): KnowledgeBlock {
    return this.knowledgeBlocks.createDraft(request.user, body);
  }

  @Get()
  list(@Req() request: RequestWithUser, @Query() query: KnowledgeListQuery): KnowledgeBlock[] {
    return this.knowledgeBlocks.listBlocks(request.user, toListFilter(query));
  }

  @Get("published")
  listPublished(): KnowledgeBlock[] {
    return this.knowledgeBlocks.listPublishedBlocks();
  }

  @Get(":blockId")
  get(@Req() request: RequestWithUser, @Param("blockId") blockId: string): KnowledgeBlock {
    return this.knowledgeBlocks.getBlock(request.user, blockId);
  }

  @Post(":blockId/submit-review")
  submitReview(@Req() request: RequestWithUser, @Param("blockId") blockId: string): KnowledgeBlock {
    return this.knowledgeBlocks.submitForReview(request.user, blockId);
  }

  @Post(":blockId/review")
  review(
    @Req() request: RequestWithUser,
    @Param("blockId") blockId: string,
    @Body() body: ReviewKnowledgeBlockRequest
  ): KnowledgeBlock {
    return this.knowledgeBlocks.reviewBlock(request.user, blockId, body);
  }

  @Post(":blockId/disable")
  disable(
    @Req() request: RequestWithUser,
    @Param("blockId") blockId: string,
    @Body() body: DisableKnowledgeBlockRequest = {}
  ): KnowledgeBlock {
    return this.knowledgeBlocks.disableBlock(request.user, blockId, body.reviewNote);
  }
}

function toListFilter(query: KnowledgeListQuery): KnowledgeBlockListFilter {
  return {
    status: query.status,
    publishedOnly: query.publishedOnly === true || query.publishedOnly === "true"
  };
}
