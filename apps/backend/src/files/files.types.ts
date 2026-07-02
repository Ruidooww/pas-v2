import type { ExportFormat } from "../export/export.types";

export type FilesConfig = {
  driver: "local";
  root: string;
};

export type SaveFileRequest = {
  format?: ExportFormat;
  fileName: string;
  contentType: string;
  content: Buffer;
  metadata?: Record<string, string>;
};

export type StoredFileRecord = {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

export type ReadFileResult = StoredFileRecord & {
  content: Buffer;
};
