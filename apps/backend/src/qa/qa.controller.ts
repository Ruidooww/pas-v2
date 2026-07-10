import { BadRequestException, Body, Controller, Inject, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedUser } from "../auth/auth.types";
import { createThrottleConfig } from "../throttle.config";
import { QA_SERVICE } from "./qa.tokens";
import type { QaAskRequest, QaAskResponse } from "./qa.types";
import type { QaService } from "./qa.service";

type RequestWithUser = {
  user: AuthenticatedUser;
};

const throttleConfig = createThrottleConfig();

@Controller("api/internal/qa")
export class QaController {
  constructor(@Inject(QA_SERVICE) private readonly qaService: QaService) {}

  @Throttle({ default: { limit: throttleConfig.qaLimit, ttl: throttleConfig.ttlMs } })
  @Post("ask")
  async ask(@Req() request: RequestWithUser, @Body() body: QaAskRequest): Promise<QaAskResponse> {
    const query = body.query?.trim();
    if (!query) {
      throw new BadRequestException("query is required");
    }

    return this.qaService.ask({
      query,
      userId: request.user.userId,
      user: request.user
    });
  }
}
