import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { QA_SERVICE } from "./qa.tokens";
import type { QaAskRequest, QaAskResponse } from "./qa.types";
import type { QaService } from "./qa.service";

@Controller("api/internal/qa")
export class QaController {
  constructor(@Inject(QA_SERVICE) private readonly qaService: QaService) {}

  @Post("ask")
  async ask(@Body() body: QaAskRequest): Promise<QaAskResponse> {
    const query = body.query?.trim();
    if (!query) {
      throw new BadRequestException("query is required");
    }

    return this.qaService.ask({
      query,
      userId: body.userId
    });
  }
}
