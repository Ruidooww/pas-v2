import { existsSync } from "node:fs";

const windowsDockerPath = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";

export function dockerCommand() {
  if (process.platform === "win32" && existsSync(windowsDockerPath)) {
    return windowsDockerPath;
  }

  return "docker";
}
