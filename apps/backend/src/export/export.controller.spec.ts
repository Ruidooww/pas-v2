import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ExportController } from "./export.controller";
import type { ExportService } from "./export.service";
import type { ExportCreateRequest } from "./export.types";

describe("ExportController", () => {
  it("rejects requests without an export package id", async () => {
    const service = {
      createExport: vi.fn()
    } as unknown as ExportService;
    const controller = new ExportController(service);

    await expect(controller.create({ exportPackage: undefined as never })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.createExport).not.toHaveBeenCalled();
  });

  it("delegates export creation, status lookup, and download", async () => {
    const job = {
      jobId: "export-job-1",
      sourcePackageId: "export-package-1",
      customerId: "demo-huaxin-manufacturing",
      status: "completed",
      formats: [],
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z"
    };
    const download = {
      fileName: "proposal.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      contentBase64: "ZmlsZQ==",
      size: 4
    };
    const service = {
      createExport: vi.fn().mockResolvedValue(job),
      getJobOrThrow: vi.fn().mockReturnValue(job),
      download: vi.fn().mockResolvedValue(download)
    } as unknown as ExportService;
    const controller = new ExportController(service);
    const body = {
      exportPackage: {
        packageId: "export-package-1",
        customerId: "demo-huaxin-manufacturing"
      },
      formats: ["docx" as const],
      userId: "user-1"
    } as unknown as ExportCreateRequest;

    await expect(controller.create(body)).resolves.toEqual(job);
    expect(controller.getJob("export-job-1")).toEqual(job);
    await expect(controller.download("export-job-1", "docx", "downloader-1")).resolves.toEqual(download);
    expect(service.createExport).toHaveBeenCalledWith(body);
    expect(service.getJobOrThrow).toHaveBeenCalledWith("export-job-1");
    expect(service.download).toHaveBeenCalledWith("export-job-1", "docx", "downloader-1");
  });
});
