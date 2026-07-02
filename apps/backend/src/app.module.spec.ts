import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

describe("AppModule", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("starts with all V0 modules wired through the Nest container", async () => {
    app = await NestFactory.create(AppModule, {
      logger: false
    });

    expect(app).toBeDefined();
  });
});
