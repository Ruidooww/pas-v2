import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser, UserRole } from "../auth/auth.types";
import type { OrganizationService } from "../organization/organization.service";
import { DEFAULT_ORGANIZATION_UNIT_IDS } from "../organization/organization.types";
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
    private readonly sink: PersistenceSink | undefined,
    private readonly organizationService: OrganizationService
  ) {}

  seed(documents: KnowledgeDocument[]): void {
    for (const document of documents) {
      if (!this.documents.has(document.documentId)) {
        this.documents.set(
          document.documentId,
          cloneDocument({
            ...document,
            visibility: normalizeVisibility(document.visibility, true)
          })
        );
      }
    }
  }

  hasDocuments(): boolean {
    return this.documents.size > 0;
  }

  getAccessibleDocumentIds(user: AuthenticatedUser): string[] {
    return [...this.documents.values()]
      .filter((document) => document.enabled && document.parseStatus === "done")
      .filter((document) => this.canReadDocument(user, document))
      .map((document) => document.documentId);
  }

  upsertDocument(user: AuthenticatedUser, request: UpsertKnowledgeDocumentRequest): KnowledgeDocument {
    this.assertCanMaintain(user, request.documentId);
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
    const canMaintain = this.canMaintain(user);
    return [...this.documents.values()]
      .filter((document) => canMaintain || (document.enabled && document.parseStatus === "done"))
      .filter((document) => this.canReadDocument(user, document))
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
    if (!this.canMaintain(user) && document.ownerUserId !== user.userId && (!document.enabled || document.parseStatus !== "done")) {
      this.recordDenied(user, documentId, "DOCUMENT_READ_FORBIDDEN");
      throw new ForbiddenException("enabled parsed document is required");
    }
    if (!this.canReadDocument(user, document)) {
      this.recordDenied(user, documentId, "DOCUMENT_READ_FORBIDDEN");
      throw new ForbiddenException("document is not visible to user");
    }
    return cloneDocument(document);
  }

  updateTags(user: AuthenticatedUser, documentId: string, tags: string[]): KnowledgeDocument {
    this.assertCanMaintain(user, documentId);
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
    this.assertCanMaintain(user, documentId);
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
    this.assertCanMaintain(user, documentId);
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

  private canReadDocument(user: AuthenticatedUser, document: KnowledgeDocument): boolean {
    if (this.canMaintain(user) || document.ownerUserId === user.userId) {
      return true;
    }
    if (document.visibility.scope === "public") {
      return true;
    }
    if (document.visibility.scope === "roles") {
      return document.visibility.roles.includes(user.role);
    }
    if (document.visibility.scope === "users") {
      return document.visibility.userIds.includes(user.userId);
    }
    if (document.visibility.scope === "organization_units") {
      return this.organizationService.isUserInAnyUnit(user, document.visibility.organizationUnitIds);
    }
    return this.organizationService.isUserInAnyProjectGroup(user, document.visibility.projectGroupIds);
  }

  private canMaintain(user: AuthenticatedUser): boolean {
    return user.role === "admin" || this.organizationService.isActiveTechnicalMember(user);
  }

  private assertCanMaintain(user: AuthenticatedUser, documentId: string): void {
    if (this.canMaintain(user)) return;
    this.recordDenied(user, documentId, "DOCUMENT_MUTATION_FORBIDDEN");
    throw new ForbiddenException("admin or active technical department membership is required");
  }

  private recordDenied(user: AuthenticatedUser, documentId: string, failureReason: string): void {
    this.auditLog.record({
      action: "knowledge",
      actorUserId: user.userId,
      objectType: "knowledge_document",
      objectId: documentId,
      result: "failure",
      failureReason
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
    visibility: normalizeVisibility(
      request.visibility ?? {
        scope: "organization_units",
        organizationUnitIds: [DEFAULT_ORGANIZATION_UNIT_IDS.technical]
      }
    ),
    failureReason: request.failureReason
  };
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function cloneDocument(document: KnowledgeDocument): KnowledgeDocument {
  return {
    ...document,
    tags: [...document.tags],
    visibility: cloneVisibility(document.visibility)
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeVisibility(
  visibility: KnowledgeDocument["visibility"],
  allowLegacyRole = false
): KnowledgeDocument["visibility"] {
  if (visibility.scope === "roles") {
    return { scope: "roles", roles: normalizeRoleTargets(visibility.roles, allowLegacyRole) };
  }
  if (visibility.scope === "users") {
    return { scope: "users", userIds: [...new Set(visibility.userIds)] };
  }
  if (visibility.scope === "organization_units") {
    return {
      scope: "organization_units",
      organizationUnitIds: [...new Set(visibility.organizationUnitIds)]
    };
  }
  if (visibility.scope === "project_groups") {
    return { scope: "project_groups", projectGroupIds: [...new Set(visibility.projectGroupIds)] };
  }
  return { scope: "public" };
}

function normalizeRoleTargets(roles: readonly unknown[], allowLegacyRole: boolean): UserRole[] {
  const normalized = roles.map((role) => {
    if (role === "presales" && allowLegacyRole) return "technical";
    if (role === "sales" || role === "technical" || role === "admin") return role;
    throw new BadRequestException(`unsupported document visibility role: ${String(role)}`);
  });
  return [...new Set(normalized)];
}

function cloneVisibility(visibility: KnowledgeDocument["visibility"]): KnowledgeDocument["visibility"] {
  if (visibility.scope === "roles") return { scope: "roles", roles: [...visibility.roles] };
  if (visibility.scope === "users") return { scope: "users", userIds: [...visibility.userIds] };
  if (visibility.scope === "organization_units") {
    return { scope: "organization_units", organizationUnitIds: [...visibility.organizationUnitIds] };
  }
  if (visibility.scope === "project_groups") {
    return { scope: "project_groups", projectGroupIds: [...visibility.projectGroupIds] };
  }
  return { scope: "public" };
}
