import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ExportController } from "./export.controller";
import type { ExportService } from "./export.service";
import type { ExportCreateRequest } from "./export.types";

describe("ExportController", () => {
  const request = {
    user: {
      userId: "authenticated-user",
      username: "user@example.com",
      displayName: "Authenticated User",
      role: "presales" as const
    }
  };

  it("rejects requests without an export package id", async () => {
    const service = {
      createExport: vi.fn()
    } as unknown as ExportService;
    const controller = new ExportController(service);

    await expect(controller.create(request, { exportPackage: undefined as never })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.createExport).not.toHaveBeenCalled();
  });

  it("rejects unsupported export formats before creating a job", async () => {
    const service = {
      createExport: vi.fn()
    } as unknown as ExportService;
    const controller = new ExportController(service);
    const body = {
      exportPackage: {
        packageId: "export-package-1",
        customerId: "demo-huaxin-manufacturing"
      },
      formats: ["pdf"]
    } as unknown as ExportCreateRequest;

    await expect(controller.create(request, body)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.createExport).not.toHaveBeenCalled();
  });

  it("delegates export creation, status lookup, and download using the authenticated user", async () => {
    const job = {
      jobId: "export-job-1",
      sourcePackageId: "export-package-1",
      customerId: "demo-huaxin-manufacturing",
      userId: "authenticated-user",
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
      getJobForUser: vi.fn().mockReturnValue(job),
      download: vi.fn().mockResolvedValue(download)
    } as unknown as ExportService;
    const controller = new ExportController(service);
    const body = {
      exportPackage: {
        packageId: "export-package-1",
        customerId: "demo-huaxin-manufacturing"
      },
      formats: ["docx" as const],
      userId: "spoofed-user"
    } as unknown as ExportCreateRequest;

    await expect(controller.create(request, body)).resolves.toEqual(job);
    expect(controller.getJob(request, "export-job-1")).toEqual(job);
    await expect(controller.download(request, "export-job-1", "docx")).resolves.toEqual(download);
    expect(service.createExport).toHaveBeenCalledWith({
      ...body,
      userId: "authenticated-user"
    });
    expect(service.getJobForUser).toHaveBeenCalledWith("export-job-1", request.user);
    expect(service.download).toHaveBeenCalledWith("export-job-1", "docx", request.user);
  });

  it("lists export jobs visible to the authenticated user", () => {
    const jobs = [
      {
        jobId: "export-job-1",
        sourcePackageId: "export-package-1",
        customerId: "demo-huaxin-manufacturing",
        userId: "authenticated-user",
        status: "completed",
        formats: [],
        createdAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z"
      }
    ];
    const service = {
      listJobsForUser: vi.fn().mockReturnValue(jobs)
    } as unknown as ExportService;
    const controller = new ExportController(service);

    expect(controller.list(request)).toEqual(jobs);
    expect(service.listJobsForUser).toHaveBeenCalledWith(request.user);
  });
});
