import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { FeedbackService } from "./feedback.service";
import { FEEDBACK_SERVICE } from "./feedback.tokens";
import type { FeedbackRecord, SubmitFeedbackRequest, UpdateFeedbackStatusRequest } from "./feedback.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/feedback")
export class FeedbackController {
  constructor(@Inject(FEEDBACK_SERVICE) private readonly feedbackService: FeedbackService) {}

  @Post()
  submit(@Req() request: RequestWithUser, @Body() body: SubmitFeedbackRequest): FeedbackRecord {
    return this.feedbackService.submitFeedback(request.user, body);
  }

  @Get()
  list(@Req() request: RequestWithUser): FeedbackRecord[] {
    return this.feedbackService.listFeedback(request.user);
  }

  @Patch(":feedbackId")
  update(
    @Req() request: RequestWithUser,
    @Param("feedbackId") feedbackId: string,
    @Body() body: UpdateFeedbackStatusRequest
  ): FeedbackRecord {
    return this.feedbackService.updateStatus(request.user, feedbackId, body);
  }
}
