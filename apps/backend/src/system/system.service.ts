import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createFilesConfig } from "../files/files.config";
import type { FilesConfig } from "../files/files.types";
import { createLlmConfig } from "../llm/llm.config";
import { createRagflowConfig } from "../ragflow/ragflow.config";
import type { SystemOverview, SystemPathStatus, SystemSettingItem } from "./system.types";

const MAX_SCANNED_FILES = 500;

export class SystemService {
  constructor(
    private readonly filesConfig: FilesConfig = createFilesConfig(),
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async getOverview(): Promise<SystemOverview> {
    const exportConfig = this.createExportConfig();
    return {
      generatedAt: new Date().toISOString(),
      settings: this.buildSettings(),
      paths: [
        await inspectPath("文件存储", this.filesConfig.root),
        await inspectPath("导出模板", exportConfig.templateRoot)
      ]
    };
  }

  private buildSettings(): SystemSettingItem[] {
    const ragflow = createRagflowConfig(this.env);
    const llm = createLlmConfig(this.env);
    const exportConfig = this.createExportConfig();

    return [
      setting("ragflow", "RAGFLOW_CLIENT_MODE", "RAGFlow 模式", ragflow.clientMode, ragflow.clientMode === "disabled" ? "disabled" : "enabled"),
      setting("ragflow", "RAGFLOW_BASE_URL", "RAGFlow 地址", ragflow.baseUrl, envStatus(this.env, "RAGFLOW_BASE_URL")),
      setting("ragflow", "QA_KB_ID", "问答知识库", ragflow.qaKbId || "missing", ragflow.qaKbId ? "configured" : "missing"),
      setting("ragflow", "PAS_KB_ID", "PAS 知识库", ragflow.pasKbId || "missing", ragflow.pasKbId ? "configured" : "missing"),
      secretSetting("ragflow", "RAGFLOW_API_KEY", "RAGFlow API Key", this.env.RAGFLOW_API_KEY),
      setting("llm", "LLM_CLIENT_MODE", "LLM 模式", llm.mode, llm.mode === "real" ? "enabled" : "default"),
      setting("llm", "LLM_BASE_URL", "LLM 地址", llm.baseUrl, envStatus(this.env, "LLM_BASE_URL")),
      setting("llm", "LLM_MODEL", "LLM 模型", llm.model, envStatus(this.env, "LLM_MODEL")),
      secretSetting("llm", "LLM_API_KEY", "LLM API Key", this.env.LLM_API_KEY),
      setting("storage", "FILE_STORAGE_ROOT", "文件存储根目录", this.filesConfig.root, envStatus(this.env, "FILE_STORAGE_ROOT")),
      setting("export", "EXPORT_TEMPLATE_ROOT", "导出模板目录", exportConfig.templateRoot, envStatus(this.env, "EXPORT_TEMPLATE_ROOT")),
      setting("export", "EXPORT_TEMPLATE_VERSION", "导出模板版本", exportConfig.templateVersion, envStatus(this.env, "EXPORT_TEMPLATE_VERSION")),
      secretSetting("database", "DATABASE_URL", "数据库连接", this.env.DATABASE_URL)
    ];
  }

  private createExportConfig(): { templateRoot: string; templateVersion: string } {
    return {
      templateRoot:
        this.env.EXPORT_TEMPLATE_ROOT?.trim() ||
        path.resolve(process.cwd(), "templates", "export", "v0"),
      templateVersion: this.env.EXPORT_TEMPLATE_VERSION?.trim() || "v0-unconfigured"
    };
  }
}

function setting(
  group: SystemSettingItem["group"],
  key: string,
  label: string,
  value: string,
  status: SystemSettingItem["status"]
): SystemSettingItem {
  return {
    group,
    key,
    label,
    value,
    status,
    secret: false
  };
}

function secretSetting(
  group: SystemSettingItem["group"],
  key: string,
  label: string,
  rawValue: string | undefined
): SystemSettingItem {
  const configured = Boolean(rawValue?.trim());
  return {
    group,
    key,
    label,
    value: configured ? "configured" : "missing",
    status: configured ? "configured" : "missing",
    secret: true
  };
}

function envStatus(env: NodeJS.ProcessEnv, key: string): SystemSettingItem["status"] {
  return env[key]?.trim() ? "configured" : "default";
}

async function inspectPath(label: string, rawPath: string): Promise<SystemPathStatus> {
  const targetPath = path.resolve(rawPath);
  const status: SystemPathStatus = {
    label,
    path: targetPath,
    exists: false,
    writable: false,
    fileCount: 0,
    totalBytes: 0,
    truncated: false
  };

  try {
    const stat = await fs.stat(targetPath);
    status.exists = true;
    if (stat.isDirectory()) {
      const scan = await scanDirectory(targetPath);
      status.fileCount = scan.fileCount;
      status.totalBytes = scan.totalBytes;
      status.truncated = scan.truncated;
    } else {
      status.fileCount = 1;
      status.totalBytes = stat.size;
    }
  } catch {
    return status;
  }

  try {
    await fs.access(targetPath, fsConstants.W_OK);
    status.writable = true;
  } catch {
    status.writable = false;
  }

  return status;
}

async function scanDirectory(root: string): Promise<Pick<SystemPathStatus, "fileCount" | "totalBytes" | "truncated">> {
  let fileCount = 0;
  let totalBytes = 0;
  let truncated = false;

  async function visit(directory: string): Promise<void> {
    if (fileCount >= MAX_SCANNED_FILES) {
      truncated = true;
      return;
    }

    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (fileCount >= MAX_SCANNED_FILES) {
        truncated = true;
        return;
      }
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(entryPath);
        fileCount += 1;
        totalBytes += stat.size;
      }
    }
  }

  await visit(root);
  return { fileCount, totalBytes, truncated };
}
