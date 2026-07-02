import { Module } from "@nestjs/common";
import { createFilesConfig } from "./files.config";
import { FilesService } from "./files.service";
import { FILES_CONFIG, FILES_SERVICE } from "./files.tokens";
import type { FilesConfig } from "./files.types";

@Module({
  providers: [
    {
      provide: FILES_CONFIG,
      useFactory: (): FilesConfig => createFilesConfig()
    },
    {
      provide: FILES_SERVICE,
      useFactory: (config: FilesConfig): FilesService => new FilesService(config),
      inject: [FILES_CONFIG]
    }
  ],
  exports: [FILES_SERVICE]
})
export class FilesModule {}
