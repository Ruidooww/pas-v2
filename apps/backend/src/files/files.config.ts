import path from "node:path";
import type { FilesConfig } from "./files.types";

export function createFilesConfig(): FilesConfig {
  return {
    driver: "local",
    root: process.env.FILE_STORAGE_ROOT?.trim() || path.resolve(process.cwd(), "tmp", "pas-files")
  };
}
