import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  const port = Number(process.env.PORT || 3000);

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
