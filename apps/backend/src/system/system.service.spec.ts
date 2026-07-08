import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SystemService } from "./system.service";

describe("SystemService", () => {
  it("returns sanitized settings and bounded local path stats", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pas-system-"));
    await fs.writeFile(path.join(root, "sample.txt"), "sample");
    const env = {
      RAGFLOW_API_KEY: "ragflow-secret",
      RAGFLOW_BASE_URL: "http://localhost:19380",
      QA_KB_ID: "qa-kb",
      LLM_API_KEY: "llm-secret",
      LLM_CLIENT_MODE: "real",
      LLM_MODEL: "qwen-max",
      DATABASE_URL: "postgres://user:secret@localhost/pas",
      EXPORT_TEMPLATE_ROOT: root
    } as NodeJS.ProcessEnv;

    const overview = await new SystemService({ driver: "local", root }, env).getOverview();

    expect(overview.settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "LOGIN_BRANDING", value: "default logo", secret: false }),
        expect.objectContaining({ key: "RAGFLOW_API_KEY", value: "configured", secret: true }),
        expect.objectContaining({ key: "LLM_API_KEY", value: "configured", secret: true }),
        expect.objectContaining({ key: "DATABASE_URL", value: "configured", secret: true }),
        expect.objectContaining({ key: "QA_KB_ID", value: "qa-kb", secret: false }),
        expect.objectContaining({ key: "LLM_MODEL", value: "qwen-max", secret: false })
      ])
    );
    expect(overview.branding).toEqual(
      expect.objectContaining({
        title: "PAS 售前辅助系统",
        subtitle: "账号由管理员分配，如无账号请联系管理员"
      })
    );
    expect(JSON.stringify(overview)).not.toContain("ragflow-secret");
    expect(JSON.stringify(overview)).not.toContain("llm-secret");
    expect(JSON.stringify(overview)).not.toContain("postgres://");
    expect(overview.paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "文件存储",
          exists: true,
          writable: true,
          fileCount: 1,
          totalBytes: 6
        })
      ])
    );
  });

  it("persists custom login branding under the file storage root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pas-system-"));
    const service = new SystemService({ driver: "local", root }, {});

    await expect(
      service.updateLoginBranding("admin-1", {
        title: "HYYN 售前工作台",
        subtitle: "统一售前入口",
        logoUrl: "https://example.com/logo.png"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        title: "HYYN 售前工作台",
        subtitle: "统一售前入口",
        logoUrl: "https://example.com/logo.png",
        updatedBy: "admin-1"
      })
    );

    await expect(service.getLoginBranding()).resolves.toEqual(
      expect.objectContaining({
        title: "HYYN 售前工作台",
        logoUrl: "https://example.com/logo.png"
      })
    );
  });

  it("rejects non-http and non-absolute-path login logo urls", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pas-system-"));
    const service = new SystemService({ driver: "local", root }, {});

    await expect(service.updateLoginBranding("admin-1", { logoUrl: "javascript:alert(1)" })).rejects.toThrow(
      "logoUrl must be an absolute path or http(s) URL"
    );
  });
});
