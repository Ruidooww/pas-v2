import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { KnowledgeDocumentController } from "./knowledge-document.controller";
import type { KnowledgeDocumentService } from "./knowledge-document.service";
import type { UpsertKnowledgeDocumentRequest } from "./knowledge.types";

const request = {
  user: createUser("admin")
};

describe("KnowledgeDocumentController", () => {
  it("delegates create and list requests with filters", () => {
    const document = { documentId: "doc-1", parseStatus: "done" };
    const service = {
      upsertDocument: vi.fn().mockReturnValue(document),
      listDocuments: vi.fn().mockReturnValue([document])
    } as unknown as KnowledgeDocumentService;
    const controller = new KnowledgeDocumentController(service);
    const body = createRequest();

    expect(controller.upsert(request, body)).toBe(document);
    expect(controller.list(request, { parseStatus: "done", enabled: "true", product: "IP-Guard", tag: "manual" })).toEqual([
      document
    ]);
    expect(service.upsertDocument).toHaveBeenCalledWith(request.user, body);
    expect(service.listDocuments).toHaveBeenCalledWith(request.user, {
      parseStatus: "done",
      enabled: true,
      product: "IP-Guard",
      tag: "manual"
    });
  });

  it("delegates detail, tags, enablement, and reparse operations", () => {
    const document = { documentId: "doc-1", parseStatus: "pending" };
    const service = {
      getDocument: vi.fn().mockReturnValue(document),
      updateTags: vi.fn().mockReturnValue(document),
      setEnabled: vi.fn().mockReturnValue(document),
      requestReparse: vi.fn().mockReturnValue(document)
    } as unknown as KnowledgeDocumentService;
    const controller = new KnowledgeDocumentController(service);

    expect(controller.get(request, "doc-1")).toBe(document);
    expect(controller.updateTags(request, "doc-1", { tags: ["IP-Guard"] })).toBe(document);
    expect(controller.setEnabled(request, "doc-1", { enabled: false, reason: "duplicate" })).toBe(document);
    expect(controller.requestReparse(request, "doc-1", { reason: "parser config changed" })).toBe(document);
    expect(service.getDocument).toHaveBeenCalledWith(request.user, "doc-1");
    expect(service.updateTags).toHaveBeenCalledWith(request.user, "doc-1", ["IP-Guard"]);
    expect(service.setEnabled).toHaveBeenCalledWith(request.user, "doc-1", false, "duplicate");
    expect(service.requestReparse).toHaveBeenCalledWith(request.user, "doc-1", "parser config changed");
  });
});

function createRequest(): UpsertKnowledgeDocumentRequest {
  return {
    documentId: "doc-1",
    title: "IP-Guard Manual",
    product: "IP-Guard",
    materialType: "pdf",
    sourceName: "manual.pdf",
    parseStatus: "done"
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
