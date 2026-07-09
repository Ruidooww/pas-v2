import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesService } from "./files.service";

describe("FilesService", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "pas-files-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("normalizes traversal and reserved names before storing files", async () => {
    const service = new FilesService({ driver: "local", root });

    const stored = await service.saveFile({
      fileName: "..\\..\\CON.txt ",
      contentType: "text/plain",
      content: Buffer.from("payload")
    });

    expect(stored.fileName).toBe("file-CON.txt");
    expect(stored.key).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f-]+-file-CON\.txt$/);
    expect(stored.key).not.toContain("..");
    expect(stored.key).not.toContain("\\");
  });

  it("uses a fallback name when the original file name has no usable characters", async () => {
    const service = new FilesService({ driver: "local", root });

    const stored = await service.saveFile({
      fileName: " .. ",
      contentType: "text/plain",
      content: Buffer.from("payload")
    });

    expect(stored.fileName).toBe("file");
    expect(stored.key).toMatch(/^\d{4}-\d{2}-\d{2}\/[0-9a-f-]+-file$/);
  });
});
