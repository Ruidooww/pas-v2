import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dockerCommand } from "./docker-cli.mjs";

const expectedServices = ["pas-backend", "pas-frontend", "pas-postgres", "pas-redis"];
const expectedContainers = ["HYYN-backend", "HYYN-frontend", "HYYN-postgres", "HYYN-redis"];
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const forbiddenCredentialDefaults = [
  { pattern: /change-me/i, label: "change-me placeholder password" },
  { pattern: /redis:\/\/pas-redis:6379/i, label: "unauthenticated Redis URL" }
];
const requiredFrontendHeaders = [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy"
];
const requiredModelEnvironmentNames = [
  "MODEL_CONFIG_ENCRYPTION_KEY",
  "MODEL_ENDPOINT_ALLOWLIST",
  "THROTTLE_MODEL_TEST_LIMIT_PER_MINUTE"
];

for (const relativePath of ["docker-compose.yml", ".env.example"]) {
  const content = readFileSync(path.join(projectRoot, relativePath), "utf8");
  const match = forbiddenCredentialDefaults.find(({ pattern }) => pattern.test(content));
  if (match) {
    console.error(`Forbidden compose credential default in ${relativePath}: ${match.label}`);
    process.exit(1);
  }
}

const frontendNginxConfig = readFileSync(path.join(projectRoot, "apps/frontend/nginx.conf"), "utf8");
for (const header of requiredFrontendHeaders) {
  if (!new RegExp(`add_header\\s+${header}\\s+`, "i").test(frontendNginxConfig)) {
    console.error(`Expected frontend nginx.conf to set ${header}.`);
    process.exit(1);
  }
}

const preservesForwardedProtocol =
  /map\s+\$http_x_forwarded_proto\s+\$pas_forwarded_proto\s*\{[\s\S]*?""\s+\$scheme;[\s\S]*?default\s+\$http_x_forwarded_proto;[\s\S]*?\}/i.test(
    frontendNginxConfig
  ) && /proxy_set_header\s+X-Forwarded-Proto\s+\$pas_forwarded_proto;/i.test(frontendNginxConfig);
if (!preservesForwardedProtocol) {
  console.error("Expected frontend nginx.conf to preserve upstream X-Forwarded-Proto and fall back to $scheme.");
  process.exit(1);
}

const composeContent = readFileSync(path.join(projectRoot, "docker-compose.yml"), "utf8");
const requiredBackendEnvironmentDefaults = [
  { name: "COOKIE_SECURE", value: "true" },
  { name: "THROTTLE_LOGIN_LIMIT_PER_MINUTE", value: "10" },
  { name: "THROTTLE_MODEL_TEST_LIMIT_PER_MINUTE", value: "5" },
  { name: "THROTTLE_QA_LIMIT_PER_MINUTE", value: "30" },
  { name: "TRUST_PROXY_HOPS", value: "1" }
];

for (const { name, value } of requiredBackendEnvironmentDefaults) {
  const pattern = new RegExp(`${name}:\\s+\\$\\{${name}:-${value}\\}`);
  if (!pattern.test(composeContent)) {
    console.error(`Expected backend compose environment to default ${name}=${value}.`);
    process.exit(1);
  }
}

for (const name of requiredModelEnvironmentNames) {
  if (!new RegExp(`${name}:\\s+\\$\\{${name}:-`).test(composeContent)) {
    console.error(`Expected backend compose environment to propagate ${name}.`);
    process.exit(1);
  }
}

const envExample = readFileSync(path.join(projectRoot, ".env.example"), "utf8");
for (const name of requiredModelEnvironmentNames) {
  if (!new RegExp(`^${name}=`, "m").test(envExample)) {
    console.error(`Expected .env.example to document ${name}.`);
    process.exit(1);
  }
}

const composeEnv = {
  ...process.env,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "pas-compose-verify-postgres-password",
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "pas-compose-verify-redis-password"
};

const serviceOutput = execFileSync(dockerCommand(), ["compose", "config", "--services"], {
  encoding: "utf8",
  env: composeEnv,
  stdio: ["ignore", "pipe", "pipe"]
});

const services = serviceOutput
  .split(/\r?\n/)
  .map((service) => service.trim())
  .filter(Boolean)
  .sort();

if (JSON.stringify(services) !== JSON.stringify(expectedServices)) {
  console.error(`Expected PAS services: ${expectedServices.join(", ")}`);
  console.error(`Actual services: ${services.join(", ")}`);
  process.exit(1);
}

const configOutput = execFileSync(dockerCommand(), ["compose", "config"], {
  encoding: "utf8",
  env: composeEnv,
  stdio: ["ignore", "pipe", "pipe"]
});
const containers = [...configOutput.matchAll(/container_name:\s*(\S+)/g)]
  .map((match) => match[1])
  .sort();

if (JSON.stringify(containers) !== JSON.stringify(expectedContainers)) {
  console.error(`Expected PAS container names: ${expectedContainers.join(", ")}`);
  console.error(`Actual container names: ${containers.join(", ")}`);
  process.exit(1);
}

if (!configOutput.includes("--requirepass")) {
  console.error("Expected Redis service to enable --requirepass.");
  process.exit(1);
}

if (!/REDIS_URL:\s+redis:\/\/:[^@\s]+@pas-redis:6379/i.test(configOutput)) {
  console.error("Expected backend REDIS_URL to authenticate to pas-redis.");
  process.exit(1);
}

for (const envName of ["LLM_TIMEOUT_MS", "THROTTLE_LIMIT_PER_MINUTE"]) {
  if (!new RegExp(`${envName}:\\s+\\S+`).test(configOutput)) {
    console.error(`Expected backend ${envName} to be present in compose config.`);
    process.exit(1);
  }
}

console.log(
  `Validated PAS compose services: ${services.join(", ")}; containers: ${containers.join(", ")}`
);
