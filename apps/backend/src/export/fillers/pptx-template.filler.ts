import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { ExportViewModel } from "../export-view-model";

// The V0 temp pptx template uses flat text tags on fixed layout slides
// (cover / sections summary / citations / assumptions). Docxtemplater fills
// pptx text tags in place; per-section slide cloning arrives with the real
// company master template in V1 template expansion.
export function fillPptxTemplate(templateContent: Buffer, viewModel: ExportViewModel): Buffer {
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    linebreaks: true
  });
  doc.render({
    customerName: viewModel.customerName,
    title: viewModel.title,
    generatedAt: viewModel.generatedAt,
    reviewNotice: viewModel.reviewNotice,
    sectionsSummary: viewModel.sectionsSummary,
    citationsSummary: viewModel.citationsSummary,
    assumptionsSummary: viewModel.assumptionsSummary
  });
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
