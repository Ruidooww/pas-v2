import { describe, expect, it, vi } from "vitest";
import type { ExportPackage } from "../proposal/proposal.types";
import type { FilesService } from "../files/files.service";
import {
  ExportService,
  ExportTemplateFieldMissingError,
  ExportTemplateMissingError
} from "./export.service";
import { ExportAuditLogService } from "./export-audit-log.service";
import { ExportJobStoreService } from "./export-job-store.service";
import type { ExportFormat, ExportRenderer, ExportTemplateCatalog } from "./export.types";

const exportPackage: ExportPackage = {
  packageId: "export-package-1",
  proposalDraftId: "proposal-draft-1",
  customerId: "demo-huaxin-manufacturing",
  status: "ready_for_export",
  formats: ["docx", "pptx", "xlsx"],
  payload: {
    customerAnalysisId: "ca-1",
    proposalDraft: {
      draftId: "proposal-draft-1",
      customerId: "demo-huaxin-manufacturing",
      customerName: "Huaxin Precision",
      title: "Huaxin Precision IP-Guard proposal draft",
      reviewRequired: true,
      generatedAt: "2026-07-02T00:00:00.000Z",
      sections: [
        {
          sectionId: "recommended-solution",
          title: "Recommended IP-Guard solution",
          body: "Use transparent encryption and outbound audit.",
          traces: [
            {
              source: "citation",
              chunkId: "chunk-1",
              label: "IP-Guard guide",
              note: "Transparent encryption"
            }
          ]
        }
      ],
      citations: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          title: "IP-Guard guide",
          source: "ip-guard.pdf",
          score: 0.91
        }
      ],
      assumptions: ["Requires human review."]
    }
  }
};

describe("ExportService", () => {
  it("creates docx, pptx, and xlsx files from one export package", async () => {
    const renderer = createRenderer();
    const filesService = createFilesService();
    const auditLog = new ExportAuditLogService();
    const service = createService(renderer, filesService, auditLog);

    const job = await service.createExport({
      exportPackage,
      userId: "user-1"
    });

    expect(job).toEqual(
      expect.objectContaining({
        jobId: expect.stringMatching(/^export-job-/),
        sourcePackageId: "export-package-1",
        customerId: "demo-huaxin-manufacturing",
        status: "completed"
      })
    );
    expect(job.formats).toEqual([
      expect.objectContaining({ format: "docx", status: "completed", fileKey: "files/docx-1" }),
      expect.objectContaining({ format: "pptx", status: "completed", fileKey: "files/pptx-1" }),
      expect.objectContaining({ format: "xlsx", status: "completed", fileKey: "files/xlsx-1" })
    ]);
    expect(renderer.render).toHaveBeenCalledTimes(3);
    expect(filesService.saveFile).toHaveBeenCalledTimes(3);
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "export_completed",
          jobId: job.jobId,
          userId: "user-1"
        })
      ])
    );
  });

  it("keeps successful format records when another format fails", async () => {
    const renderer = createRenderer({
      pptx: new ExportTemplateMissingError("pptx", "company-master.pptx")
    });
    const service = createService(renderer, createFilesService(), new ExportAuditLogService());

    const job = await service.createExport({
      exportPackage,
      userId: "user-1"
    });

    expect(job.status).toBe("partial");
    expect(job.formats).toEqual([
      expect.objectContaining({ format: "docx", status: "completed", fileKey: "files/docx-1" }),
      expect.objectContaining({
        format: "pptx",
        status: "failed",
        failureReason: "TEMPLATE_MISSING",
        errorMessage: expect.stringContaining("company-master.pptx")
      }),
      expect.objectContaining({ format: "xlsx", status: "completed", fileKey: "files/xlsx-1" })
    ]);
  });

  it("records missing template fields as explicit failures", async () => {
    const renderer = createRenderer({
      docx: new ExportTemplateFieldMissingError("docx", "customerName")
    });
    const service = createService(renderer, createFilesService(), new ExportAuditLogService());

    const job = await service.createExport({
      exportPackage,
      formats: ["docx"],
      userId: "user-1"
    });

    expect(job.status).toBe("failed");
    expect(job.formats).toEqual([
      expect.objectContaining({
        format: "docx",
        status: "failed",
        failureReason: "TEMPLATE_FIELD_MISSING",
        errorMessage: expect.stringContaining("customerName")
      })
    ]);
  });

  it("uses an available active template when rendering a format", async () => {
    const renderer = createRenderer();
    const filesService = createFilesService();
    const templateCatalog = createTemplateCatalog();
    const service = createService(renderer, filesService, new ExportAuditLogService(), templateCatalog);

    const job = await service.createExport({
      exportPackage,
      formats: ["docx"],
      userId: "user-1"
    });

    expect(templateCatalog.getAvailableTemplate).toHaveBeenCalledWith("docx");
    expect(renderer.render).toHaveBeenCalledWith(
      "docx",
      exportPackage,
      expect.objectContaining({
        templateId: "template-docx",
        fileName: "proposal-v1.docx",
        version: "v1-docx"
      })
    );
    expect(job.formats).toEqual([
      expect.objectContaining({
        format: "docx",
        status: "completed",
        templateId: "template-docx",
        templateVersion: "v1-docx",
        checks: expect.arrayContaining([
          expect.objectContaining({ code: "template_available", status: "passed" }),
          expect.objectContaining({ code: "file_not_empty", status: "passed" })
        ])
      })
    ]);
  });

  it("fails a format before rendering when no active real template is available", async () => {
    const renderer = createRenderer();
    const filesService = createFilesService();
    const templateCatalog = {
      getAvailableTemplate: vi.fn(async () => {
        throw new ExportTemplateMissingError("pptx", "proposal-v1.pptx");
      })
    };
    const service = createService(renderer, filesService, new ExportAuditLogService(), templateCatalog);

    const job = await service.createExport({
      exportPackage,
      formats: ["pptx"],
      userId: "user-1"
    });

    expect(renderer.render).not.toHaveBeenCalled();
    expect(filesService.saveFile).not.toHaveBeenCalled();
    expect(job.status).toBe("failed");
    expect(job.formats).toEqual([
      expect.objectContaining({
        format: "pptx",
        status: "failed",
        failureReason: "TEMPLATE_MISSING",
        checks: [expect.objectContaining({ code: "template_available", status: "failed" })]
      })
    ]);
  });

  it("fails zero-byte rendered files before saving them", async () => {
    const renderer = createRenderer({}, { docx: Buffer.alloc(0) });
    const filesService = createFilesService();
    const service = createService(renderer, filesService, new ExportAuditLogService(), createTemplateCatalog());

    const job = await service.createExport({
      exportPackage,
      formats: ["docx"],
      userId: "user-1"
    });

    expect(filesService.saveFile).not.toHaveBeenCalled();
    expect(job.status).toBe("failed");
    expect(job.formats).toEqual([
      expect.objectContaining({
        format: "docx",
        status: "failed",
        failureReason: "DELIVERABLE_CHECK_FAILED",
        checks: expect.arrayContaining([expect.objectContaining({ code: "file_not_empty", status: "failed" })])
      })
    ]);
  });

  it("downloads completed files through FilesService and records the download", async () => {
    const filesService = createFilesService();
    const auditLog = new ExportAuditLogService();
    const service = createService(createRenderer(), filesService, auditLog);
    const job = await service.createExport({ exportPackage, formats: ["docx"], userId: "user-1" });

    const download = await service.download(job.jobId, "docx", "downloader-1");

    expect(filesService.readFile).toHaveBeenCalledWith("files/docx-1");
    expect(download).toEqual(
      expect.objectContaining({
        fileName: "proposal.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contentBase64: Buffer.from("stored:files/docx-1").toString("base64")
      })
    );
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "export_downloaded",
          jobId: job.jobId,
          format: "docx",
          userId: "downloader-1"
        })
      ])
    );
  });
});

function createService(
  renderer: ExportRenderer,
  filesService: FilesService,
  auditLog: ExportAuditLogService,
  templateCatalog?: ExportTemplateCatalog
): ExportService {
  return new ExportService(renderer, filesService, new ExportJobStoreService(), auditLog, templateCatalog);
}

function createRenderer(
  failures: Partial<Record<"docx" | "pptx" | "xlsx", Error>> = {},
  contents: Partial<Record<"docx" | "pptx" | "xlsx", Buffer>> = {}
): ExportRenderer {
  return {
    render: vi.fn(async (format: ExportFormat, _exportPackage, template) => {
      const failure = failures[format];
      if (failure) {
        throw failure;
      }

      return {
        format,
        fileName: `proposal.${format}`,
        contentType: contentTypeFor(format),
        templateId: template?.templateId,
        templateVersion: template?.version ?? `v0-${format}`,
        content: contents[format] ?? Buffer.from(`rendered:${format}`)
      };
    })
  };
}

function createTemplateCatalog(): ExportTemplateCatalog {
  return {
    getAvailableTemplate: vi.fn(async (format: ExportFormat) => ({
      templateId: `template-${format}`,
      name: `Template ${format}`,
      category: "proposal" as const,
      format,
      version: `v1-${format}`,
      fileName: `proposal-v1.${format}`
    }))
  };
}

function createFilesService(): FilesService {
  return {
    saveFile: vi.fn(async (request) => ({
      key: `files/${request.format}-1`,
      fileName: request.fileName,
      contentType: request.contentType,
      size: request.content.length,
      createdAt: "2026-07-02T00:00:00.000Z"
    })),
    readFile: vi.fn(async (key) => ({
      key,
      fileName: key.endsWith("docx-1") ? "proposal.docx" : "proposal.bin",
      contentType: key.endsWith("docx-1")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/octet-stream",
      content: Buffer.from(`stored:${key}`),
      size: Buffer.byteLength(`stored:${key}`)
    }))
  } as unknown as FilesService;
}

function contentTypeFor(format: "docx" | "pptx" | "xlsx"): string {
  const contentTypes = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };
  return contentTypes[format];
}
