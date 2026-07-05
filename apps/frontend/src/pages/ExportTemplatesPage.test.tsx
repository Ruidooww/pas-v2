import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportTemplatesPage } from "./ExportTemplatesPage";

describe("ExportTemplatesPage", () => {
  beforeEach(() => {
    localStorage.setItem("pas.access-token", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            templateId: "proposal-docx-v1",
            name: "Proposal DOCX V1",
            category: "proposal",
            format: "docx",
            version: "v1.0.0",
            fileName: "proposal-v1.docx",
            status: "active",
            products: ["IP-Guard"],
            scenarios: ["standard proposal"],
            industries: [],
            tags: ["standard"],
            ownerUserId: "admin-1",
            createdAt: "2026-07-05T00:00:00.000Z",
            updatedAt: "2026-07-05T00:00:00.000Z"
          }
        ]
      })
    );
  });

  it("loads export template metadata and shows operational status", async () => {
    render(<ExportTemplatesPage />);

    expect(await screen.findByText("Proposal DOCX V1")).toBeInTheDocument();
    expect(screen.getByText("docx")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/internal/export-templates",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token"
        })
      })
    );
  });
});
