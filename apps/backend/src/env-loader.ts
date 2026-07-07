import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseEnv } from "node:util";

const DEFAULT_SKIP_KEYS = new Set<string>();
const DOCKER_ONLY_DATABASE_HOSTS = new Set(["pas-postgres"]);

type LoadLocalEnvOptions = {
  skipKeys?: readonly string[];
};

export function loadLocalEnv(startDirectory = process.cwd(), options: LoadLocalEnvOptions = {}): string | undefined {
  const envFile = findNearestEnvFile(startDirectory);
  if (!envFile) {
    return undefined;
  }

  const skipKeys = options.skipKeys ? new Set(options.skipKeys) : DEFAULT_SKIP_KEYS;
  const values = parseEnv(fs.readFileSync(envFile, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || skipKeys.has(key) || shouldSkipLocalValue(key, value) || process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
  return envFile;
}

export function findNearestEnvFile(startDirectory: string): string | undefined {
  let current = path.resolve(startDirectory);

  while (true) {
    const candidate = path.join(current, ".env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function shouldSkipLocalValue(key: string, value: string): boolean {
  if (key !== "DATABASE_URL") {
    return false;
  }

  try {
    return DOCKER_ONLY_DATABASE_HOSTS.has(new URL(value).hostname);
  } catch {
    return value.includes("@pas-postgres:") || value.includes("//pas-postgres:");
  }
}
