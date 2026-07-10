import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { OrganizationService } from "../organization/organization.service";
import { OrganizationStoreService } from "../organization/organization-store.service";
import {
  DEFAULT_ORGANIZATION_UNIT_IDS,
  createDefaultOrganizationState,
  type OrganizationState
} from "../organization/organization.types";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import type { KnowledgeDocument, UpsertKnowledgeDocumentRequest } from "./knowledge.types";

describe("KnowledgeDocumentService", () => {
  it("registers document metadata for technical users", () => {
    const { service } = createDocumentService();

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
        tags: ["IP-Guard", "manual"],
        visibility: {
          scope: "organization_units",
          organizationUnitIds: [DEFAULT_ORGANIZATION_UNIT_IDS.technical]
        }
      })
    );
  });

  it("lists documents by parse status and enabled state", () => {
    const { service } = createDocumentService();
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

  it("preserves existing public visibility when metadata upsert omits visibility", () => {
    const { service } = createDocumentService();
    service.seed([createDocument("doc-public", "done", true)]);

    const updated = service.upsertDocument(createUser("admin"), {
      ...createRequest(),
      documentId: "doc-public",
      title: "Updated public document"
    });

    expect(updated.visibility).toEqual({ scope: "public" });
  });

  it("updates tags, enablement, and reparse request metadata", () => {
    const { service } = createDocumentService();
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
    const { service } = createDocumentService();
    service.seed([createDocument("doc-1", "done", true)]);

    expect(() => service.upsertDocument(createUser("sales"), createRequest())).toThrow(ForbiddenException);
    expect(() => service.updateTags(createUser("sales"), "doc-1", ["x"])).toThrow(ForbiddenException);
    expect(() => service.setEnabled(createUser("sales"), "doc-1", false)).toThrow(ForbiddenException);
    expect(() => service.requestReparse(createUser("sales"), "doc-1")).toThrow(ForbiddenException);
    expect(() => service.getDocument(createUser("admin"), "missing-doc")).toThrow(NotFoundException);
  });

  it("enforces document visibility and reports accessible document ids", () => {
    const { service } = createDocumentService();
    service.seed([
      createDocument("doc-public", "done", true),
      { ...createDocument("doc-admin", "done", true), visibility: { scope: "roles", roles: ["admin"] } },
      { ...createDocument("doc-sales", "done", true), visibility: { scope: "roles", roles: ["sales"] } },
      { ...createDocument("doc-user", "done", true), visibility: { scope: "users", userIds: ["technical-1"] } },
      { ...createDocument("doc-disabled", "done", false), visibility: { scope: "public" } }
    ]);

    expect(service.hasDocuments()).toBe(true);
    expect(service.getAccessibleDocumentIds(createUser("sales"))).toEqual(["doc-public", "doc-sales"]);
    expect(service.getAccessibleDocumentIds(createUser("technical"))).toEqual([
      "doc-public",
      "doc-admin",
      "doc-sales",
      "doc-user"
    ]);
    expect(service.listDocuments(createUser("sales")).map((document) => document.documentId)).toEqual([
      "doc-public",
      "doc-sales"
    ]);
    expect(() => service.getDocument(createUser("sales"), "doc-admin")).toThrow(ForbiddenException);
  });

  it.each([
    [technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales), true],
    [technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalEngineering), true],
    [technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalAfterSales), true],
    [createUser("sales"), false]
  ])("applies technical-department maintenance for %o", (user, allowed) => {
    const { service } = createDocumentService();
    service.seed([createDocument("doc-1", "done", true)]);

    const action = () => service.updateTags(user, "doc-1", ["updated"]);

    if (allowed) {
      expect(action).not.toThrow();
    } else {
      expect(action).toThrow(ForbiddenException);
    }
  });

  it("fails closed for a technical user whose department membership is inactive", () => {
    const { service, organizationService } = createDocumentService();
    service.seed([createDocument("doc-1", "done", true)]);
    organizationService.updateUnit(createUser("admin"), DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales, {
      active: false
    });

    expect(() => service.updateTags(technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales), "doc-1", ["updated"])).toThrow(
      ForbiddenException
    );
  });

  it("evaluates descendant units, active project groups, and legacy presales normalization", () => {
    const { service, organizationService } = createDocumentService();
    const salesTeam = organizationService.createUnit(createUser("admin"), {
      name: "Sales Team East",
      kind: "team",
      parentUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.sales
    });
    const group = organizationService.createProjectGroup(createUser("admin"), { name: "Project Alpha" });
    service.seed([
      createDocument("doc-unit", "done", true, {
        visibility: organizationUnitVisibility([DEFAULT_ORGANIZATION_UNIT_IDS.sales])
      }),
      createDocument("doc-project", "done", true, {
        visibility: projectGroupVisibility([group.projectGroupId])
      }),
      createDocument("doc-legacy-presales", "done", true, {
        visibility: legacyPresalesVisibility()
      })
    ]);

    expect(service.getAccessibleDocumentIds({ ...createUser("sales"), organizationUnitId: salesTeam.unitId })).toEqual([
      "doc-unit"
    ]);
    expect(
      service.getAccessibleDocumentIds({
        ...createUser("sales"),
        projectGroupIds: [group.projectGroupId]
      })
    ).toEqual(["doc-unit", "doc-project"]);
    expect(service.getDocument(createUser("admin"), "doc-legacy-presales").visibility).toEqual({
      scope: "roles",
      roles: ["technical"]
    });
  });

  it("revokes organization and project-group visibility when the target becomes inactive", () => {
    const { service, organizationService } = createDocumentService();
    const salesTeam = organizationService.createUnit(createUser("admin"), {
      name: "Sales Team East",
      kind: "team",
      parentUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.sales
    });
    const group = organizationService.createProjectGroup(createUser("admin"), { name: "Project Alpha" });
    const salesUser = {
      ...createUser("sales"),
      organizationUnitId: salesTeam.unitId,
      projectGroupIds: [group.projectGroupId]
    };
    service.seed([
      createDocument("doc-unit", "done", true, {
        visibility: organizationUnitVisibility([DEFAULT_ORGANIZATION_UNIT_IDS.sales])
      }),
      createDocument("doc-project", "done", true, {
        visibility: projectGroupVisibility([group.projectGroupId])
      })
    ]);

    organizationService.updateUnit(createUser("admin"), DEFAULT_ORGANIZATION_UNIT_IDS.sales, { active: false });
    organizationService.updateProjectGroup(createUser("admin"), group.projectGroupId, { active: false });

    expect(service.getAccessibleDocumentIds(salesUser)).toEqual([]);
  });

  it("removes project-group visibility when membership is revoked", () => {
    const { service, organizationService } = createDocumentService();
    const group = organizationService.createProjectGroup(createUser("admin"), { name: "Project Alpha" });
    service.seed([
      createDocument("doc-project", "done", true, {
        visibility: projectGroupVisibility([group.projectGroupId])
      })
    ]);

    expect(
      service.getAccessibleDocumentIds({
        ...createUser("sales"),
        projectGroupIds: [group.projectGroupId]
      })
    ).toEqual(["doc-project"]);
    expect(service.getAccessibleDocumentIds(createUser("sales"))).toEqual([]);
  });

  it("allows owners and admins to read restricted documents", () => {
    const { service } = createDocumentService();
    service.seed([
      createDocument("doc-owner", "done", true, {
        ownerUserId: "owner-1",
        visibility: { scope: "roles", roles: ["admin"] }
      })
    ]);

    expect(service.getDocument({ ...createUser("sales"), userId: "owner-1" }, "doc-owner").documentId).toBe("doc-owner");
    expect(service.getDocument(createUser("admin"), "doc-owner").documentId).toBe("doc-owner");
  });

  it("rejects legacy role targets on new document requests", () => {
    const { service } = createDocumentService();

    expect(() =>
      service.upsertDocument(createUser("admin"), {
        ...createRequest(),
        visibility: legacyPresalesVisibility()
      })
    ).toThrow(BadRequestException);
  });

  it("fails closed for missing policy targets and inactive technical maintenance listing", () => {
    const { service, organizationService } = createDocumentService();
    service.seed([
      createDocument("doc-missing-unit", "done", true, {
        visibility: organizationUnitVisibility(["org-missing"])
      }),
      createDocument("doc-missing-project", "done", true, {
        visibility: projectGroupVisibility(["project-group-missing"])
      }),
      createDocument("doc-pending-public", "pending", true)
    ]);
    organizationService.updateUnit(createUser("admin"), DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales, {
      active: false
    });

    expect(service.getAccessibleDocumentIds(createUser("sales"))).toEqual([]);
    expect(() => service.getDocument(createUser("sales"), "doc-missing-unit")).toThrow(ForbiddenException);
    expect(
      service
        .listDocuments(technicalUser(DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales))
        .map((document) => document.documentId)
    ).toEqual([]);
  });

  it("audits denied direct reads and mutations", () => {
    const { service, auditLog } = createDocumentService();
    service.seed([
      createDocument("doc-restricted", "done", true, {
        visibility: { scope: "roles", roles: ["admin"] }
      })
    ]);

    expect(() => service.getDocument(createUser("sales"), "doc-restricted")).toThrow(ForbiddenException);
    expect(() => service.updateTags(createUser("sales"), "doc-restricted", ["updated"])).toThrow(ForbiddenException);

    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "knowledge",
          actorUserId: "sales-1",
          objectId: "doc-restricted",
          result: "failure",
          failureReason: "DOCUMENT_READ_FORBIDDEN"
        }),
        expect.objectContaining({
          action: "knowledge",
          actorUserId: "sales-1",
          objectId: "doc-restricted",
          result: "failure",
          failureReason: "DOCUMENT_MUTATION_FORBIDDEN"
        })
      ])
    );
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
  enabled: boolean,
  overrides: Partial<KnowledgeDocument> = {}
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
    updatedAt: "2026-07-05T00:00:00.000Z",
    ...overrides
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

function technicalUser(organizationUnitId: string): AuthenticatedUser {
  return {
    ...createUser("technical"),
    userId: `technical-${organizationUnitId}`,
    organizationUnitId
  };
}

function createDocumentService(): {
  service: KnowledgeDocumentService;
  auditLog: AuditLogService;
  organizationService: OrganizationService;
} {
  const auditLog = new AuditLogService();
  const store = new OrganizationStoreService();
  store.seed(createDefaultOrganizationState("2026-07-10T00:00:00.000Z"));
  const organizationService = new OrganizationService(store, auditLog);
  const service = new KnowledgeDocumentService(auditLog, undefined, organizationService);
  return { service, auditLog, organizationService };
}

function organizationUnitVisibility(unitIds: string[]): KnowledgeDocument["visibility"] {
  return {
    scope: "organization_units",
    organizationUnitIds: unitIds
  } as unknown as KnowledgeDocument["visibility"];
}

function projectGroupVisibility(projectGroupIds: string[]): KnowledgeDocument["visibility"] {
  return { scope: "project_groups", projectGroupIds } as unknown as KnowledgeDocument["visibility"];
}

function legacyPresalesVisibility(): KnowledgeDocument["visibility"] {
  return { scope: "roles", roles: ["presales"] } as unknown as KnowledgeDocument["visibility"];
}
