import { execFileSync } from "node:child_process";
import { dockerCommand } from "./docker-cli.mjs";

const expectedServices = ["pas-backend", "pas-frontend", "pas-postgres", "pas-redis"];
const expectedContainers = ["HYYN-backend", "HYYN-frontend", "HYYN-postgres", "HYYN-redis"];

const serviceOutput = execFileSync(dockerCommand(), ["compose", "config", "--services"], {
  encoding: "utf8",
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

console.log(
  `Validated PAS compose services: ${services.join(", ")}; containers: ${containers.join(", ")}`
);
