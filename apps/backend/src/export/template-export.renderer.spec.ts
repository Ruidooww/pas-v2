import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExportPackage } from "../proposal/proposal.types";
import { ExportTemplateMissingError } from "./export.errors";
import { TemplateExportRenderer } from "./template-export.renderer";

const exportPackage: ExportPackage = {
  packageId: "export-package-1",
  proposalDraftId: "proposal-draft-1",
  customerId: "demo-huaxin-manufacturing",
  status: "ready_for_export",
  formats: ["docx"],
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
          sectionId: "executive-summary",
          title: "Executive summary",
          body: "Review-required draft.",
          traces: [
            {
              source: "human_input",
              inputId: "input-1",
              label: "Customer input",
              note: "Manual context"
            }
          ]
        }
      ],
      citations: [],
      assumptions: ["Requires human review."]
    }
  }
};

describe("TemplateExportRenderer", () => {
  let templateRoot: string;

  beforeEach(async () => {
    templateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pas-export-templates-"));
  });

  afterEach(async () => {
    await fs.rm(templateRoot, { recursive: true, force: true });
  });

  it("fails explicitly when the requested template file is missing", async () => {
    const renderer = new TemplateExportRenderer({
      templateRoot,
      templateVersion: "v0-test"
    });

    await expect(renderer.render("docx", exportPackage)).rejects.toBeInstanceOf(ExportTemplateMissingError);
  });

  it("does not silently return an unfilled template when real template filling is not configured", async () => {
    await fs.writeFile(path.join(templateRoot, "proposal.docx"), Buffer.from("raw-template"));
    const renderer = new TemplateExportRenderer({
      templateRoot,
      templateVersion: "v0-test"
    });

    await expect(renderer.render("docx", exportPackage)).rejects.toThrow("Template renderer is not configured");
  });
});
