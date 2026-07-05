import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ForbiddenException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ExportTemplateMissingError } from "./export.errors";
import { ExportTemplateService } from "./export-template.service";

const adminUser: AuthenticatedUser = {
  userId: "admin-1",
  username: "admin@example.com",
  displayName: "Admin",
  role: "admin"
};

const salesUser: AuthenticatedUser = {
  userId: "sales-1",
  username: "sales@example.com",
  displayName: "Sales",
  role: "sales"
};

describe("ExportTemplateService", () => {
  let templateRoot: string;
  let auditLog: AuditLogService;
  let service: ExportTemplateService;

  beforeEach(async () => {
    templateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pas-export-template-service-"));
    auditLog = new AuditLogService();
    service = new ExportTemplateService(auditLog, { templateRoot });
  });

  afterEach(async () => {
    await fs.rm(templateRoot, { recursive: true, force: true });
  });

  it("registers active template metadata and returns it as available when the file exists", async () => {
    await fs.writeFile(path.join(templateRoot, "proposal-v1.docx"), Buffer.from("template"));

    const template = service.upsertTemplate(adminUser, {
      templateId: "proposal-docx-v1",
      name: "Proposal DOCX V1",
      category: "proposal",
      format: "docx",
      version: "v1.0.0",
      fileName: "proposal-v1.docx",
      status: "active",
      products: ["IP-Guard", "IP-Guard"],
      scenarios: ["standard proposal"],
      industries: [],
      tags: [" standard ", "standard"]
    });

    await expect(service.getAvailableTemplate("docx")).resolves.toEqual(
      expect.objectContaining({
        templateId: "proposal-docx-v1",
        fileName: "proposal-v1.docx",
        version: "v1.0.0"
      })
    );
    expect(template.tags).toEqual(["standard"]);
    expect(template.products).toEqual(["IP-Guard"]);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "export",
          actorUserId: "admin-1",
          objectType: "export_template",
          objectId: "proposal-docx-v1"
        })
      ])
    );
  });

  it("rejects sales users when mutating template metadata", () => {
    expect(() =>
      service.upsertTemplate(salesUser, {
        templateId: "proposal-docx-v1",
        name: "Proposal DOCX V1",
        category: "proposal",
        format: "docx",
        version: "v1.0.0",
        fileName: "proposal-v1.docx",
        status: "active",
        products: [],
        scenarios: [],
        industries: [],
        tags: []
      })
    ).toThrow(ForbiddenException);
  });

  it("fails availability when the active metadata points at a missing real template file", async () => {
    service.upsertTemplate(adminUser, {
      templateId: "proposal-docx-v1",
      name: "Proposal DOCX V1",
      category: "proposal",
      format: "docx",
      version: "v1.0.0",
      fileName: "missing.docx",
      status: "active",
      products: [],
      scenarios: [],
      industries: [],
      tags: []
    });

    await expect(service.getAvailableTemplate("docx")).rejects.toBeInstanceOf(ExportTemplateMissingError);
  });

  it("keeps disabled templates out of export availability", async () => {
    await fs.writeFile(path.join(templateRoot, "proposal-v1.pptx"), Buffer.from("template"));
    service.upsertTemplate(adminUser, {
      templateId: "proposal-pptx-v1",
      name: "Proposal PPTX V1",
      category: "proposal",
      format: "pptx",
      version: "v1.0.0",
      fileName: "proposal-v1.pptx",
      status: "active",
      products: [],
      scenarios: [],
      industries: [],
      tags: []
    });

    service.setStatus(adminUser, "proposal-pptx-v1", "disabled", "replace template");

    await expect(service.getAvailableTemplate("pptx")).rejects.toBeInstanceOf(ExportTemplateMissingError);
    expect(service.listTemplates(adminUser, { status: "disabled" })).toHaveLength(1);
  });
});
