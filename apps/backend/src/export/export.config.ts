import path from "node:path";
import type { TemplateExportRendererConfig } from "./template-export.renderer";

export function createTemplateExportRendererConfig(): TemplateExportRendererConfig {
  return {
    templateRoot:
      process.env.EXPORT_TEMPLATE_ROOT?.trim() ||
      path.resolve(process.cwd(), "templates", "export", "v0"),
    templateVersion: process.env.EXPORT_TEMPLATE_VERSION?.trim() || "v0-unconfigured"
  };
}
