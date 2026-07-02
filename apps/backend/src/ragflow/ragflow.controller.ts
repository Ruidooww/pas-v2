import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";
import type { KnowledgeChunk } from "./knowledge-chunk";
import { RagflowClient, type RagflowHealth } from "./ragflow.client";
import type { RagflowConfig } from "./ragflow.config";
import { RAGFLOW_CONFIG } from "./ragflow.tokens";

type RagflowControllerConfig = Pick<RagflowConfig, "pasKbId">;

type SearchRequest = {
  query?: string;
  topK?: number;
};

type SearchResponse = {
  chunks: KnowledgeChunk[];
};

@Controller("api/ragflow")
export class RagflowController {
  constructor(
    private readonly ragflowClient: RagflowClient,
    @Inject(RAGFLOW_CONFIG) private readonly config: RagflowControllerConfig
  ) {}

  @Get("health")
  async getHealth(): Promise<RagflowHealth> {
    return this.ragflowClient.checkHealth();
  }

  @Post("search")
  async search(@Body() body: SearchRequest): Promise<SearchResponse> {
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
      topK: body.topK
    });

    return { chunks };
  }
}
