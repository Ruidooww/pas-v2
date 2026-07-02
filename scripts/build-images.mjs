import { spawnSync } from "node:child_process";
import { dockerCommand } from "./docker-cli.mjs";

const required = ["REGISTRY_HOST", "REGISTRY_NAMESPACE", "IMAGE_TAG"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const registryHost = process.env.REGISTRY_HOST;
const namespace = process.env.REGISTRY_NAMESPACE;
const tag = process.env.IMAGE_TAG;
const shouldPush = process.env.PUSH_IMAGES === "1";

const images = [
  {
    name: "pas-backend",
    dockerfile: "apps/backend/Dockerfile",
    context: "."
  },
  {
    name: "pas-frontend",
    dockerfile: "apps/frontend/Dockerfile",
    context: "."
  }
];

for (const image of images) {
  const imageRef = `${registryHost}/${namespace}/${image.name}:${tag}`;
  const args = [
    "buildx",
    "build",
    "--file",
    image.dockerfile,
    "--tag",
    imageRef,
    shouldPush ? "--push" : "--load",
    image.context
  ];

  console.log(`Building ${imageRef}`);
  const result = spawnSync(dockerCommand(), args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
