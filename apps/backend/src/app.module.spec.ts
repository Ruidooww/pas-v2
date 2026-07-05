import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { PLATFORM_SERVICE } from "./platform/platform.tokens";

describe("AppModule", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("starts with all platform modules wired through the Nest container", async () => {
    app = await NestFactory.create(AppModule, {
      logger: false
    });

    expect(app).toBeDefined();
    expect(app.get(PLATFORM_SERVICE)).toBeDefined();
  });
});
