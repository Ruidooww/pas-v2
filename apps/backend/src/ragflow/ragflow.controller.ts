import { BadRequestException, Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { KnowledgeDocumentService } from "../knowledge/knowledge-document.service";
import { KNOWLEDGE_DOCUMENT_SERVICE } from "../knowledge/knowledge.tokens";
import type { KnowledgeChunk } from "./knowledge-chunk";
import { RagflowClient, type RagflowHealth } from "./ragflow.client";
import type { RagflowConfig } from "./ragflow.config";
import { RAGFLOW_CLIENT, RAGFLOW_CONFIG } from "./ragflow.tokens";

type RagflowControllerConfig = Pick<RagflowConfig, "pasKbId">;

type SearchRequest = {
  query?: string;
  topK?: number;
};

type SearchResponse = {
  chunks: KnowledgeChunk[];
};

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/ragflow")
export class RagflowController {
  constructor(
    @Inject(RAGFLOW_CLIENT) private readonly ragflowClient: RagflowClient,
    @Inject(RAGFLOW_CONFIG) private readonly config: RagflowControllerConfig,
    @Inject(KNOWLEDGE_DOCUMENT_SERVICE)
    private readonly documentService?: KnowledgeDocumentService
  ) {}

  @Get("health")
  async getHealth(): Promise<RagflowHealth> {
    return this.ragflowClient.checkHealth();
  }

  @Post("search")
  async search(@Req() request: RequestWithUser, @Body() body: SearchRequest): Promise<SearchResponse> {
    const query = body.query?.trim();
    if (!query) {
      throw new BadRequestException("query is required");
    }

    if (!this.config.pasKbId) {
      throw new BadRequestException("PAS_KB_ID is not configured");
    }

    const chunks = await this.ragflowClient.retrieveKnowledgeChunks({
      datasetId: this.config.pasKbId,
      query,
      topK: body.topK,
      ...(this.documentService?.hasDocuments()
        ? { allowedDocumentIds: this.documentService.getAccessibleDocumentIds(request.user) }
        : {})
    });

    return { chunks };
  }
}
