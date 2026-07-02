import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { ExportViewModel } from "../export-view-model";

export function fillDocxTemplate(templateContent: Buffer, viewModel: ExportViewModel): Buffer {
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });
  doc.render(viewModel);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
