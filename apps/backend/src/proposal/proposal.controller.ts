import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
  ProposalJobAccessDeniedError,
  ProposalJobRetryRejectedError,
  ProposalService
} from "./proposal.service";
import type { ProposalGenerationRequest, ProposalHumanInput, ProposalJob, ProposalLibraryItem } from "./proposal.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/proposals")
export class ProposalController {
  constructor(@Inject(PROPOSAL_SERVICE) private readonly proposalService: ProposalService) {}

  @Get()
  listJobs(@Req() request: RequestWithUser): ProposalJob[] {
    return this.proposalService.listJobsForUser(request.user);
  }

  @Post("generate")
  async generate(@Req() request: RequestWithUser, @Body() body: ProposalGenerationRequest): Promise<ProposalJob> {
    const customerId = body.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException("customerId is required");
    }
    const humanInputs = parseHumanInputs(body.humanInputs);

    return this.proposalService.generate({
      customerId,
      userId: request.user.userId,
      user: request.user,
      humanInputs
    });
  }

  @Get("library")
  listLibrary(@Req() request: RequestWithUser): ProposalLibraryItem[] {
    return this.proposalService.listLibrary(request.user);
  }

  @Get(":jobId")
  getJob(@Req() request: RequestWithUser, @Param("jobId") jobId: string): ProposalJob {
    try {
      return this.proposalService.getJobForUser(jobId, request.user);
    } catch (error) {
      throw mapProposalError(error);
    }
  }

  @Post(":jobId/retry")
  async retry(@Req() request: RequestWithUser, @Param("jobId") jobId: string): Promise<ProposalJob> {
    try {
      return await this.proposalService.retry(jobId, request.user);
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

  if (error instanceof ProposalJobAccessDeniedError) {
    return new ForbiddenException(error.message);
  }

  return error instanceof Error ? error : new Error("Proposal request failed");
}

function parseHumanInputs(value: unknown): ProposalHumanInput[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException("humanInputs must be an array");
  }

  return value.map((input) => {
    if (!isProposalHumanInput(input)) {
      throw new BadRequestException("humanInputs must contain string inputId, label, and value");
    }
    return input;
  });
}

function isProposalHumanInput(value: unknown): value is ProposalHumanInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  const input = value as Record<string, unknown>;
  return typeof input.inputId === "string" && typeof input.label === "string" && typeof input.value === "string";
}
