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
import type { ExportFormat, ExportRenderer } from "./export.types";

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
  auditLog: ExportAuditLogService
): ExportService {
  return new ExportService(renderer, filesService, new ExportJobStoreService(), auditLog);
}

function createRenderer(failures: Partial<Record<"docx" | "pptx" | "xlsx", Error>> = {}): ExportRenderer {
  return {
    render: vi.fn(async (format: ExportFormat) => {
      const failure = failures[format];
      if (failure) {
        throw failure;
      }

      return {
        format,
        fileName: `proposal.${format}`,
        contentType: contentTypeFor(format),
        templateVersion: `v0-${format}`,
        content: Buffer.from(`rendered:${format}`)
      };
    })
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
