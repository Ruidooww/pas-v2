import { Module } from "@nestjs/common";
import { WorkbenchController } from "./workbench.controller";
import { WorkbenchService } from "./workbench.service";
import { WORKBENCH_SERVICE } from "./workbench.tokens";

@Module({
  controllers: [WorkbenchController],
  providers: [
    {
      provide: WORKBENCH_SERVICE,
      useFactory: (): WorkbenchService => new WorkbenchService()
    }
  ]
})
export class WorkbenchModule {}
