import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PROPOSAL_SERVICE } from "./proposal.tokens";
import {
  ProposalJobNotFoundError,
  ProposalJobRetryRejectedError,
  ProposalService
} from "./proposal.service";
import type { ProposalGenerationRequest, ProposalJob } from "./proposal.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/proposals")
export class ProposalController {
  constructor(@Inject(PROPOSAL_SERVICE) private readonly proposalService: ProposalService) {}

  @Post("generate")
  async generate(@Req() request: RequestWithUser, @Body() body: ProposalGenerationRequest): Promise<ProposalJob> {
    const customerId = body.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException("customerId is required");
    }

    return this.proposalService.generate({
      customerId,
      userId: request.user.userId,
      humanInputs: body.humanInputs
    });
  }

  @Get(":jobId")
  getJob(@Param("jobId") jobId: string): ProposalJob {
    try {
      return this.proposalService.getJobOrThrow(jobId);
    } catch (error) {
      throw mapProposalError(error);
    }
  }

  @Post(":jobId/retry")
  async retry(@Param("jobId") jobId: string): Promise<ProposalJob> {
    try {
      return await this.proposalService.retry(jobId);
    } catch (error) {
      throw mapProposalError(error);
    }
  }
}

function mapProposalError(error: unknown): Error {
  if (error instanceof ProposalJobNotFoundError) {
    return new NotFoundException(error.message);
  }

  if (error instanceof ProposalJobRetryRejectedError) {
    return new BadRequestException(error.message);
  }

  return error instanceof Error ? error : new Error("Proposal request failed");
}
