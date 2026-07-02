import { BadRequestException, Body, Controller, Inject, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { QA_SERVICE } from "./qa.tokens";
import type { QaAskRequest, QaAskResponse } from "./qa.types";
import type { QaService } from "./qa.service";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/qa")
export class QaController {
  constructor(@Inject(QA_SERVICE) private readonly qaService: QaService) {}

  @Post("ask")
  async ask(@Req() request: RequestWithUser, @Body() body: QaAskRequest): Promise<QaAskResponse> {
    const query = body.query?.trim();
    if (!query) {
      throw new BadRequestException("query is required");
    }

    return this.qaService.ask({
      query,
      userId: request.user.userId
    });
  }
}
