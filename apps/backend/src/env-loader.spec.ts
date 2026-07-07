import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findNearestEnvFile, loadLocalEnv } from "./env-loader";

const envKeys = ["PAS_ENV_LOADER_TEST", "PAS_ENV_LOADER_FILE_ONLY", "DATABASE_URL"] as const;
const previousEnv = new Map<string, string | undefined>();

describe("env-loader", () => {
  afterEach(() => {
    for (const key of envKeys) {
      const previous = previousEnv.get(key);
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
    previousEnv.clear();
  });

  it("finds the nearest .env by walking up from the backend cwd", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pas-env-loader-"));
    try {
      const backendDir = path.join(tempRoot, "apps", "backend");
      fs.mkdirSync(backendDir, { recursive: true });
      const envFile = path.join(tempRoot, ".env");
      fs.writeFileSync(envFile, "PAS_ENV_LOADER_FILE_ONLY=from_file\n");

      expect(findNearestEnvFile(backendDir)).toBe(envFile);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("loads .env without overriding explicit process env values", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pas-env-loader-"));
    try {
      rememberEnv();
      const backendDir = path.join(tempRoot, "apps", "backend");
      fs.mkdirSync(backendDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempRoot, ".env"),
        "PAS_ENV_LOADER_TEST=from_file\nPAS_ENV_LOADER_FILE_ONLY=loaded\nDATABASE_URL=postgresql://local-user:local-pass@127.0.0.1:5432/pas\n"
      );
      process.env.PAS_ENV_LOADER_TEST = "from_process";
      delete process.env.PAS_ENV_LOADER_FILE_ONLY;
      delete process.env.DATABASE_URL;

      expect(loadLocalEnv(backendDir)).toBe(path.join(tempRoot, ".env"));
      expect(process.env.PAS_ENV_LOADER_TEST).toBe("from_process");
      expect(process.env.PAS_ENV_LOADER_FILE_ONLY).toBe("loaded");
      expect(process.env.DATABASE_URL).toBe("postgresql://local-user:local-pass@127.0.0.1:5432/pas");
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("skips compose-only DATABASE_URL values when running backend locally", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pas-env-loader-"));
    try {
      rememberEnv();
      const backendDir = path.join(tempRoot, "apps", "backend");
      fs.mkdirSync(backendDir, { recursive: true });
      fs.writeFileSync(path.join(tempRoot, ".env"), "DATABASE_URL=postgresql://pas:pas@pas-postgres:5432/pas\n");
      delete process.env.DATABASE_URL;

      expect(loadLocalEnv(backendDir)).toBe(path.join(tempRoot, ".env"));
      expect(process.env.DATABASE_URL).toBeUndefined();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

function rememberEnv(): void {
  for (const key of envKeys) {
    previousEnv.set(key, process.env[key]);
  }
}
