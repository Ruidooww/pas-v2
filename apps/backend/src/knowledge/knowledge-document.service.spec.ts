import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import type { KnowledgeDocument, UpsertKnowledgeDocumentRequest } from "./knowledge.types";

describe("KnowledgeDocumentService", () => {
  it("registers document metadata for technical users", () => {
    const service = new KnowledgeDocumentService(new AuditLogService());

    const document = service.upsertDocument(createUser("technical"), createRequest());

    expect(document).toEqual(
      expect.objectContaining({
        documentId: "doc-1",
        title: "IP-Guard Manual",
        product: "IP-Guard",
        materialType: "pdf",
        parseStatus: "done",
        enabled: true,
        chunkCount: 42,
        hitCount: 0,
        badFeedbackCount: 0,
        ownerUserId: "technical-1",
        tags: ["IP-Guard", "manual"]
      })
    );
  });

  it("lists documents by parse status and enabled state", () => {
    const service = new KnowledgeDocumentService(new AuditLogService());
    service.seed([
      createDocument("doc-ready", "done", true),
      createDocument("doc-failed", "failed", true),
      createDocument("doc-disabled", "done", false)
    ]);

    expect(service.listDocuments(createUser("admin"), { parseStatus: "done", enabled: true })).toEqual([
      createDocument("doc-ready", "done", true)
    ]);
    expect(service.listDocuments(createUser("sales"))).toEqual([createDocument("doc-ready", "done", true)]);
  });

  it("updates tags, enablement, and reparse request metadata", () => {
    const service = new KnowledgeDocumentService(new AuditLogService());
    service.seed([createDocument("doc-1", "failed", true)]);

    const tagged = service.updateTags(createUser("admin"), "doc-1", ["IP-Guard", "FAQ"]);
    const disabled = service.setEnabled(createUser("admin"), "doc-1", false, "duplicate material");
    const reparse = service.requestReparse(createUser("technical"), "doc-1", "parser params changed");

    expect(tagged.tags).toEqual(["IP-Guard", "FAQ"]);
    expect(disabled).toEqual(
      expect.objectContaining({
        enabled: false,
        disabledReason: "duplicate material"
      })
    );
    expect(reparse).toEqual(
      expect.objectContaining({
        parseStatus: "pending",
        reparseRequestedBy: "technical-1",
        reparseReason: "parser params changed",
        reparseRequestedAt: expect.any(String)
      })
    );
  });

  it("enforces role boundaries and missing document handling", () => {
    const service = new KnowledgeDocumentService(new AuditLogService());
    service.seed([createDocument("doc-1", "done", true)]);

    expect(() => service.upsertDocument(createUser("sales"), createRequest())).toThrow(ForbiddenException);
    expect(() => service.updateTags(createUser("sales"), "doc-1", ["x"])).toThrow(ForbiddenException);
    expect(() => service.setEnabled(createUser("sales"), "doc-1", false)).toThrow(ForbiddenException);
    expect(() => service.requestReparse(createUser("sales"), "doc-1")).toThrow(ForbiddenException);
    expect(() => service.getDocument(createUser("admin"), "missing-doc")).toThrow(NotFoundException);
  });

  it("enforces document visibility and reports accessible document ids", () => {
    const service = new KnowledgeDocumentService(new AuditLogService());
    service.seed([
      createDocument("doc-public", "done", true),
      { ...createDocument("doc-admin", "done", true), visibility: { scope: "roles", roles: ["admin"] } },
      { ...createDocument("doc-sales", "done", true), visibility: { scope: "roles", roles: ["sales"] } },
      { ...createDocument("doc-user", "done", true), visibility: { scope: "users", userIds: ["technical-1"] } },
      { ...createDocument("doc-disabled", "done", false), visibility: { scope: "public" } }
    ]);

    expect(service.hasDocuments()).toBe(true);
    expect(service.getAccessibleDocumentIds(createUser("sales"))).toEqual(["doc-public", "doc-sales"]);
    expect(service.getAccessibleDocumentIds(createUser("technical"))).toEqual(["doc-public", "doc-user"]);
    expect(service.listDocuments(createUser("sales")).map((document) => document.documentId)).toEqual([
      "doc-public",
      "doc-sales"
    ]);
    expect(() => service.getDocument(createUser("sales"), "doc-admin")).toThrow(ForbiddenException);
  });
});

function createRequest(): UpsertKnowledgeDocumentRequest {
  return {
    documentId: "doc-1",
    title: "IP-Guard Manual",
    product: "IP-Guard",
    materialType: "pdf",
    sourceName: "manual.pdf",
    parseStatus: "done",
    chunkCount: 42,
    tags: ["IP-Guard", "manual"]
  };
}

function createDocument(
  documentId: string,
  parseStatus: KnowledgeDocument["parseStatus"],
  enabled: boolean
): KnowledgeDocument {
  return {
    documentId,
    title: documentId,
    product: "IP-Guard",
    materialType: "pdf",
    sourceName: `${documentId}.pdf`,
    parseStatus,
    enabled,
    chunkCount: parseStatus === "done" ? 12 : 0,
    hitCount: 0,
    badFeedbackCount: 0,
    tags: ["IP-Guard"],
    visibility: { scope: "public" },
    ownerUserId: "admin-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    userId: `${role}-1`,
    username: `${role}@example.com`,
    displayName: role,
    role,
    organizationUnitId: role === "sales" ? "org-sales" : role === "technical" ? "org-technical-presales" : "org-company",
    projectGroupIds: []
  };
}
