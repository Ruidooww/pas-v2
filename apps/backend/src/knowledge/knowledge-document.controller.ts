import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import { KNOWLEDGE_DOCUMENT_SERVICE } from "./knowledge.tokens";
import type {
  KnowledgeDocument,
  KnowledgeDocumentListFilter,
  KnowledgeDocumentParseStatus,
  UpsertKnowledgeDocumentRequest
} from "./knowledge.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

type KnowledgeDocumentListQuery = {
  parseStatus?: KnowledgeDocumentParseStatus;
  enabled?: string | boolean;
  product?: string;
  tag?: string;
};

type UpdateTagsRequest = {
  tags: string[];
};

type SetEnabledRequest = {
  enabled: boolean;
  reason?: string;
};

type RequestReparseRequest = {
  reason?: string;
};

@Controller("api/internal/knowledge-documents")
export class KnowledgeDocumentController {
  constructor(@Inject(KNOWLEDGE_DOCUMENT_SERVICE) private readonly documents: KnowledgeDocumentService) {}

  @Post()
  upsert(@Req() request: RequestWithUser, @Body() body: UpsertKnowledgeDocumentRequest): KnowledgeDocument {
    return this.documents.upsertDocument(request.user, body);
  }

  @Get()
  list(@Req() request: RequestWithUser, @Query() query: KnowledgeDocumentListQuery): KnowledgeDocument[] {
    return this.documents.listDocuments(request.user, toListFilter(query));
  }

  @Get(":documentId")
  get(@Req() request: RequestWithUser, @Param("documentId") documentId: string): KnowledgeDocument {
    return this.documents.getDocument(request.user, documentId);
  }

  @Post(":documentId/tags")
  updateTags(
    @Req() request: RequestWithUser,
    @Param("documentId") documentId: string,
    @Body() body: UpdateTagsRequest
  ): KnowledgeDocument {
    return this.documents.updateTags(request.user, documentId, body.tags);
  }

  @Post(":documentId/enabled")
  setEnabled(
    @Req() request: RequestWithUser,
    @Param("documentId") documentId: string,
    @Body() body: SetEnabledRequest
  ): KnowledgeDocument {
    return this.documents.setEnabled(request.user, documentId, body.enabled, body.reason);
  }

  @Post(":documentId/reparse")
  requestReparse(
    @Req() request: RequestWithUser,
    @Param("documentId") documentId: string,
    @Body() body: RequestReparseRequest = {}
  ): KnowledgeDocument {
    return this.documents.requestReparse(request.user, documentId, body.reason);
  }
}

function toListFilter(query: KnowledgeDocumentListQuery): KnowledgeDocumentListFilter {
  return {
    parseStatus: query.parseStatus,
    enabled: query.enabled === undefined ? undefined : query.enabled === true || query.enabled === "true",
    product: query.product,
    tag: query.tag
  };
}
