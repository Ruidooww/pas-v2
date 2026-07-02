import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { CUSTOMER_ANALYSIS_SERVICE } from "./customer-analysis.tokens";
import type { CustomerAnalysisRequest, CustomerAnalysisResult } from "./customer-analysis.types";
import type { CustomerAnalysisService } from "./customer-analysis.service";

@Controller("api/internal/customer-analysis")
export class CustomerAnalysisController {
  constructor(@Inject(CUSTOMER_ANALYSIS_SERVICE) private readonly service: CustomerAnalysisService) {}

  @Post("analyze")
  async analyze(@Body() body: CustomerAnalysisRequest): Promise<CustomerAnalysisResult> {
    const customerId = body.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException("customerId is required");
    }

    return this.service.analyze({
      customerId,
      userId: body.userId
    });
  }
}
