import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { loadLocalEnv } from "./env-loader";
import { createHelmetOptions } from "./security-headers";
import { createThrottleConfig } from "./throttle.config";
import { configureTrustProxy } from "./trusted-proxy";

async function bootstrap(): Promise<void> {
  loadLocalEnv();
  const { AppModule } = await import("./app.module.js");
  const app = await NestFactory.create(AppModule);
  configureTrustProxy(app.getHttpAdapter().getInstance(), createThrottleConfig().trustProxyHops);
  app.use(helmet(createHelmetOptions()));
  const port = Number(process.env.PORT || 3000);

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
