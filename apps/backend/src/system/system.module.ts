import { Module } from "@nestjs/common";
import { createFilesConfig } from "../files/files.config";
import { SystemController } from "./system.controller";
import { SystemService } from "./system.service";
import { SYSTEM_SERVICE } from "./system.tokens";

@Module({
  controllers: [SystemController],
  providers: [
    {
      provide: SYSTEM_SERVICE,
      useFactory: (): SystemService => new SystemService(createFilesConfig(), process.env)
    }
  ]
})
export class SystemModule {}
