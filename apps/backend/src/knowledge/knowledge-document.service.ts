import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PersistenceSink } from "../persistence/persistence-sink";
import type {
  KnowledgeDocument,
  KnowledgeDocumentListFilter,
  UpsertKnowledgeDocumentRequest
} from "./knowledge.types";

type NormalizedKnowledgeDocumentInput = Omit<
  UpsertKnowledgeDocumentRequest,
  "badFeedbackCount" | "chunkCount" | "hitCount" | "tags" | "visibility"
> & {
  badFeedbackCount: number;
  chunkCount: number;
  hitCount: number;
  tags: string[];
  visibility: KnowledgeDocument["visibility"];
};

export class KnowledgeDocumentService {
  private readonly documents = new Map<string, KnowledgeDocument>();

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly sink?: PersistenceSink
  ) {}

  seed(documents: KnowledgeDocument[]): void {
    for (const document of documents) {
      if (!this.documents.has(document.documentId)) {
        this.documents.set(document.documentId, cloneDocument(document));
      }
    }
  }

  hasDocuments(): boolean {
    return this.documents.size > 0;
  }

  getAccessibleDocumentIds(user: AuthenticatedUser): string[] {
    return [...this.documents.values()]
      .filter((document) => document.enabled && document.parseStatus === "done")
      .filter((document) => isVisibleToUser(user, document))
      .map((document) => document.documentId);
  }

  upsertDocument(user: AuthenticatedUser, request: UpsertKnowledgeDocumentRequest): KnowledgeDocument {
    assertOperator(user);
    const current = this.documents.get(request.documentId);
    const now = nowIso();
    const normalized = normalizeRequest(request);
    const document: KnowledgeDocument = {
      ...current,
      ...normalized,
      enabled: current?.enabled ?? true,
      ownerUserId: current?.ownerUserId ?? user.userId,
      createdAt: current?.createdAt ?? now,
      updatedAt: now
    };
    this.save(user, document, "knowledge_document_upserted");
    return cloneDocument(document);
  }

  listDocuments(user: AuthenticatedUser, filter: KnowledgeDocumentListFilter = {}): KnowledgeDocument[] {
    return [...this.documents.values()]
      .filter((document) => (user.role === "sales" ? document.enabled && document.parseStatus === "done" : true))
      .filter((document) => isVisibleToUser(user, document))
      .filter((document) => (filter.parseStatus ? document.parseStatus === filter.parseStatus : true))
      .filter((document) => (filter.enabled === undefined ? true : document.enabled === filter.enabled))
      .filter((document) => (filter.product ? document.product === filter.product : true))
      .filter((document) => (filter.tag ? document.tags.includes(filter.tag) : true))
      .map(cloneDocument);
  }

  getDocument(user: AuthenticatedUser, documentId: string): KnowledgeDocument {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new NotFoundException("knowledge document not found");
    }
    if (user.role === "sales" && (!document.enabled || document.parseStatus !== "done")) {
      throw new ForbiddenException("enabled parsed document is required");
    }
    if (!isVisibleToUser(user, document)) {
      throw new ForbiddenException("document is not visible to user");
    }
    return cloneDocument(document);
  }

  updateTags(user: AuthenticatedUser, documentId: string, tags: string[]): KnowledgeDocument {
    assertOperator(user);
    const document = this.getExistingDocument(documentId);
    const updated: KnowledgeDocument = {
      ...document,
      tags: normalizeTags(tags),
      updatedAt: nowIso()
    };
    this.save(user, updated, "knowledge_document_tags_updated");
    return cloneDocument(updated);
  }

  setEnabled(user: AuthenticatedUser, documentId: string, enabled: boolean, reason?: string): KnowledgeDocument {
    assertOperator(user);
    const document = this.getExistingDocument(documentId);
    const updated: KnowledgeDocument = {
      ...document,
      enabled,
      disabledReason: enabled ? undefined : reason,
      updatedAt: nowIso()
    };
    this.save(user, updated, enabled ? "knowledge_document_enabled" : "knowledge_document_disabled");
    return cloneDocument(updated);
  }

  requestReparse(user: AuthenticatedUser, documentId: string, reason?: string): KnowledgeDocument {
    assertOperator(user);
    const document = this.getExistingDocument(documentId);
    const now = nowIso();
    const updated: KnowledgeDocument = {
      ...document,
      parseStatus: "pending",
      reparseRequestedAt: now,
      reparseRequestedBy: user.userId,
      reparseReason: reason,
      updatedAt: now
    };
    this.save(user, updated, "knowledge_document_reparse_requested");
    return cloneDocument(updated);
  }

  private getExistingDocument(documentId: string): KnowledgeDocument {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new NotFoundException("knowledge document not found");
    }
    return document;
  }

  private save(user: AuthenticatedUser, document: KnowledgeDocument, reason: string): void {
    this.documents.set(document.documentId, cloneDocument(document));
    this.sink?.mirrorKnowledgeDocument(document);
    this.auditLog.record({
      action: "knowledge",
      actorUserId: user.userId,
      objectType: "knowledge_document",
      objectId: document.documentId,
      result: "success",
      failureReason: reason
    });
  }
}

function normalizeRequest(request: UpsertKnowledgeDocumentRequest): NormalizedKnowledgeDocumentInput {
  return {
    documentId: request.documentId.trim(),
    title: request.title.trim(),
    product: request.product.trim(),
    materialType: request.materialType,
    sourceName: request.sourceName.trim(),
    parseStatus: request.parseStatus,
    chunkCount: Math.max(0, request.chunkCount ?? 0),
    hitCount: Math.max(0, request.hitCount ?? 0),
    badFeedbackCount: Math.max(0, request.badFeedbackCount ?? 0),
    tags: normalizeTags(request.tags ?? []),
    visibility: request.visibility ?? { scope: "public" },
    failureReason: request.failureReason
  };
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function assertOperator(user: AuthenticatedUser): void {
  if (user.role !== "admin" && user.role !== "technical") {
    throw new ForbiddenException("admin or technical role is required");
  }
}

function cloneDocument(document: KnowledgeDocument): KnowledgeDocument {
  return {
    ...document,
    tags: [...document.tags],
    visibility:
      document.visibility.scope === "roles"
        ? { scope: "roles", roles: [...document.visibility.roles] }
        : document.visibility.scope === "users"
          ? { scope: "users", userIds: [...document.visibility.userIds] }
          : { scope: "public" }
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function isVisibleToUser(user: AuthenticatedUser, document: KnowledgeDocument): boolean {
  if (document.visibility.scope === "public") {
    return true;
  }
  if (document.visibility.scope === "roles") {
    return document.visibility.roles.includes(user.role);
  }
  return document.visibility.userIds.includes(user.userId);
}
