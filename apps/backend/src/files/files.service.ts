import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FilesConfig, ReadFileResult, SaveFileRequest, StoredFileRecord } from "./files.types";

export class FileNotFoundError extends Error {
  constructor(key: string) {
    super(`File not found: ${key}`);
    this.name = "FileNotFoundError";
  }
}

export class FilesService {
  private readonly records = new Map<string, StoredFileRecord>();

  constructor(private readonly config: FilesConfig) {}

  async saveFile(request: SaveFileRequest): Promise<StoredFileRecord> {
    const key = createFileKey(request.fileName);
    const targetPath = this.resolveKey(key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, request.content);

    const record: StoredFileRecord = {
      key,
      fileName: request.fileName,
      contentType: request.contentType,
      size: request.content.length,
      createdAt: new Date().toISOString()
    };
    this.records.set(key, record);
    return record;
  }

  async readFile(key: string): Promise<ReadFileResult> {
    const record = this.records.get(key);
    if (!record) {
      throw new FileNotFoundError(key);
    }

    const content = await fs.readFile(this.resolveKey(key));
    return {
      ...record,
      content
    };
  }

  private resolveKey(key: string): string {
    const root = path.resolve(this.config.root);
    const targetPath = path.resolve(root, key);
    if (targetPath !== root && !targetPath.startsWith(`${root}${path.sep}`)) {
      throw new Error("File key escapes storage root");
    }
    return targetPath;
  }
}

function createFileKey(fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
}
