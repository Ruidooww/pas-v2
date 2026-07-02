import { execFileSync } from "node:child_process";
import { dockerCommand } from "./docker-cli.mjs";

const expected = ["pas-backend", "pas-frontend", "pas-postgres", "pas-redis"];

const output = execFileSync(dockerCommand(), ["compose", "config", "--services"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

const services = output
  .split(/\r?\n/)
  .map((service) => service.trim())
  .filter(Boolean)
  .sort();

if (JSON.stringify(services) !== JSON.stringify(expected)) {
  console.error(`Expected PAS services: ${expected.join(", ")}`);
  console.error(`Actual services: ${services.join(", ")}`);
  process.exit(1);
}

console.log(`Validated PAS compose services: ${services.join(", ")}`);
