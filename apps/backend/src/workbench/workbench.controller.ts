import { Controller, Get, Inject, Query } from "@nestjs/common";
import { WorkbenchService } from "./workbench.service";
import { WORKBENCH_SERVICE } from "./workbench.tokens";
import type { WorkbenchOverview, WorkbenchTask, WorkbenchTaskScope } from "./workbench.types";

@Controller("api/internal/workbench")
export class WorkbenchController {
  constructor(@Inject(WORKBENCH_SERVICE) private readonly workbenchService: WorkbenchService) {}

  @Get("overview")
  getOverview(): WorkbenchOverview {
    return this.workbenchService.getOverview();
  }

  @Get("tasks")
  listTasks(@Query("scope") scope?: WorkbenchTaskScope): { scope: WorkbenchTaskScope; tasks: WorkbenchTask[] } {
    const normalizedScope = scope === "team" ? "team" : "mine";
    return {
      scope: normalizedScope,
      tasks: this.workbenchService.listTasks(normalizedScope)
    };
  }
}
