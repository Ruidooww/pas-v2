import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { RegressionService } from "./regression.service";
import { REGRESSION_SERVICE } from "./feedback.tokens";
import type { CreateRegressionRunRequest, RegressionReport, RegressionRun } from "./feedback.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/regression-runs")
export class RegressionController {
  constructor(@Inject(REGRESSION_SERVICE) private readonly regressionService: RegressionService) {}

  @Post()
  create(@Req() request: RequestWithUser, @Body() body: CreateRegressionRunRequest): RegressionRun {
    return this.regressionService.createRun(request.user, body);
  }

  @Get(":runId")
  getRun(@Req() request: RequestWithUser, @Param("runId") runId: string): RegressionRun {
    return this.regressionService.getRun(request.user, runId);
  }

  @Get(":runId/report")
  getReport(@Req() request: RequestWithUser, @Param("runId") runId: string): RegressionReport {
    return this.regressionService.getReport(request.user, runId);
  }
}
