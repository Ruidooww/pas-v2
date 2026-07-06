import { BadRequestException, Body, Controller, Inject, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CUSTOMER_ANALYSIS_SERVICE } from "./customer-analysis.tokens";
import type { CustomerAnalysisRequest, CustomerAnalysisResult } from "./customer-analysis.types";
import type { CustomerAnalysisService } from "./customer-analysis.service";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/customer-analysis")
export class CustomerAnalysisController {
  constructor(@Inject(CUSTOMER_ANALYSIS_SERVICE) private readonly service: CustomerAnalysisService) {}

  @Post("analyze")
  async analyze(@Req() request: RequestWithUser, @Body() body: CustomerAnalysisRequest): Promise<CustomerAnalysisResult> {
    const customerId = body.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException("customerId is required");
    }

    return this.service.analyze({
      customerId,
      userId: request.user.userId,
      user: request.user
    });
  }
}
