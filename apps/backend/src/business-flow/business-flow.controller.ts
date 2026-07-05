import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { BUSINESS_FLOW_SERVICE } from "./business-flow.tokens";
import type {
  AnswerAfterSalesRequest,
  ChannelContextRequest,
  ConfirmOpportunityRequest,
  CustomerSignalRequest,
  ExtractOpportunityRequest,
  MaintenanceReminderRequest,
  ReviewContractRequest,
  SummarizeMeetingRequest
} from "./business-flow.service";
import type { BusinessFlowRecord, BusinessMetrics } from "./business-flow.types";
import type { BusinessFlowService } from "./business-flow.service";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/business-flows")
export class BusinessFlowController {
  constructor(@Inject(BUSINESS_FLOW_SERVICE) private readonly service: BusinessFlowService) {}

  @Post("opportunities/extract")
  async extractOpportunity(
    @Req() request: RequestWithUser,
    @Body() body: ExtractOpportunityRequest
  ): Promise<BusinessFlowRecord> {
    requireText(body.text, "text is required");
    return this.service.extractOpportunity(
      {
        text: body.text.trim(),
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Patch("opportunities/:recordId/confirm")
  confirmOpportunity(
    @Param("recordId") recordId: string,
    @Body() body: ConfirmOpportunityRequest,
    @Req() request: RequestWithUser
  ): BusinessFlowRecord {
    if (!body.opportunity) {
      throw new BadRequestException("opportunity is required");
    }
    return this.service.confirmOpportunity(recordId, body, request.user);
  }

  @Post("opportunities/:recordId/sync-request")
  requestOpportunitySync(
    @Param("recordId") recordId: string,
    @Req() request: RequestWithUser
  ): BusinessFlowRecord {
    return this.service.requestOpportunitySync(recordId, request.user);
  }

  @Post("meetings/summarize")
  async summarizeMeeting(
    @Req() request: RequestWithUser,
    @Body() body: SummarizeMeetingRequest
  ): Promise<BusinessFlowRecord> {
    requireText(body.customerId, "customerId is required");
    requireText(body.transcript, "transcript is required");
    return this.service.summarizeMeeting(
      {
        customerId: body.customerId.trim(),
        transcript: body.transcript.trim(),
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Post("meetings/:recordId/proposal")
  async createMeetingProposal(
    @Param("recordId") recordId: string,
    @Req() request: RequestWithUser
  ): Promise<{ record: BusinessFlowRecord; proposalJob: unknown }> {
    return this.service.createMeetingProposal(recordId, request.user);
  }

  @Post("contracts/review")
  reviewContract(@Req() request: RequestWithUser, @Body() body: ReviewContractRequest): BusinessFlowRecord {
    requireText(body.customerId, "customerId is required");
    requireText(body.contractTitle, "contractTitle is required");
    requireText(body.contractText, "contractText is required");
    return this.service.reviewContract(
      {
        customerId: body.customerId.trim(),
        contractTitle: body.contractTitle.trim(),
        contractText: body.contractText.trim(),
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Patch("contracts/:recordId/confirm")
  confirmContractReview(
    @Param("recordId") recordId: string,
    @Req() request: RequestWithUser
  ): BusinessFlowRecord {
    return this.service.confirmContractReview(recordId, request.user);
  }

  @Post("after-sales/answer")
  answerAfterSales(@Req() request: RequestWithUser, @Body() body: AnswerAfterSalesRequest): BusinessFlowRecord {
    requireText(body.customerId, "customerId is required");
    requireText(body.question, "question is required");
    return this.service.answerAfterSales(
      {
        customerId: body.customerId.trim(),
        question: body.question.trim(),
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Post("after-sales/maintenance-reminders")
  createMaintenanceReminders(
    @Req() request: RequestWithUser,
    @Body() body: MaintenanceReminderRequest
  ): BusinessFlowRecord {
    requireText(body.customerId, "customerId is required");
    requireText(body.productName, "productName is required");
    requireText(body.contractEndDate, "contractEndDate is required");
    return this.service.createMaintenanceReminders(
      {
        customerId: body.customerId.trim(),
        productName: body.productName.trim(),
        contractEndDate: body.contractEndDate.trim(),
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Post("channels/context")
  buildChannelContext(@Req() request: RequestWithUser, @Body() body: ChannelContextRequest): BusinessFlowRecord {
    requireText(body.partnerName, "partnerName is required");
    requireText(body.customerName, "customerName is required");
    return this.service.buildChannelContext(
      {
        ...body,
        partnerName: body.partnerName.trim(),
        partnerLevel: body.partnerLevel?.trim() || "standard",
        customerName: body.customerName.trim(),
        pricePolicy: body.pricePolicy?.trim() || "not_configured",
        registrationStatus: body.registrationStatus?.trim() || "unknown",
        authorizedRegions: Array.isArray(body.authorizedRegions) ? body.authorizedRegions : [],
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Post("customer-signals/analyze")
  async analyzeCustomerSignals(
    @Req() request: RequestWithUser,
    @Body() body: CustomerSignalRequest
  ): Promise<BusinessFlowRecord> {
    requireText(body.customerId, "customerId is required");
    return this.service.analyzeCustomerSignals(
      {
        customerId: body.customerId.trim(),
        manualSignals: body.manualSignals,
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Get("records")
  listRecords(@Req() request: RequestWithUser): { records: BusinessFlowRecord[] } {
    return { records: this.service.listRecords(request.user) };
  }

  @Get("metrics")
  getMetrics(@Req() request: RequestWithUser): BusinessMetrics {
    return this.service.getMetrics(request.user);
  }
}

function requireText(value: string | undefined, message: string): void {
  if (!value?.trim()) {
    throw new BadRequestException(message);
  }
}

function normalizeSourceRef(value: string | undefined): string {
  return value?.trim() || "manual";
}
