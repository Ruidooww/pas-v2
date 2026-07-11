import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Put,
  Req
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthenticatedUser } from "../auth/auth.types";
import { createThrottleConfig } from "../throttle.config";
import { AiModelError } from "./ai-model.errors";
import type { AiModelManagementService } from "./ai-model-management.service";
import { AI_MODEL_MANAGEMENT } from "./ai-model.tokens";
import type { AiModelCandidateRequest, AiModelOverview, AiModelTestResult, RagflowModelOverview } from "./ai-model.types";

type RequestWithUser = {
  user?: AuthenticatedUser;
  secure?: boolean;
  protocol?: string;
  ip?: string;
  socket?: { remoteAddress?: string };
};

const throttleConfig = createThrottleConfig();

@Controller("api/internal/ai-models")
export class AiModelController {
  constructor(@Inject(AI_MODEL_MANAGEMENT) private readonly management: AiModelManagementService) {}

  @Get("overview")
  getOverview(@Req() requestOrUser: RequestWithUser | AuthenticatedUser): AiModelOverview {
    requireAdmin(requestOrUser);
    return this.management.getOverview();
  }

  @Throttle({ default: { limit: throttleConfig.modelTestLimit, ttl: throttleConfig.ttlMs } })
  @Post("generation/test")
  testGeneration(
    @Req() request: RequestWithUser,
    @Body() body: AiModelCandidateRequest
  ): Promise<AiModelTestResult> {
    const user = requireAdmin(request);
    requireSecureWrite(request);
    return mapModelErrors(() => this.management.testGeneration(user.userId, body ?? ({} as AiModelCandidateRequest)));
  }

  @Put("generation")
  saveGeneration(
    @Req() request: RequestWithUser,
    @Body() body: AiModelCandidateRequest
  ): Promise<AiModelOverview> {
    const user = requireAdmin(request);
    requireSecureWrite(request);
    return mapModelErrors(() => this.management.saveGeneration(user.userId, body ?? ({} as AiModelCandidateRequest)));
  }

  @Delete("generation")
  disableGeneration(@Req() request: RequestWithUser): Promise<AiModelOverview> {
    const user = requireAdmin(request);
    requireSecureWrite(request);
    return mapModelErrors(() => this.management.disableGeneration(user.userId));
  }

  @Get("ragflow")
  getRagflowOverview(@Req() requestOrUser: RequestWithUser | AuthenticatedUser): Promise<RagflowModelOverview> {
    requireAdmin(requestOrUser);
    return this.management.getRagflowOverview();
  }
}

function requireAdmin(requestOrUser: RequestWithUser | AuthenticatedUser): AuthenticatedUser {
  const user = "role" in requestOrUser ? requestOrUser : requestOrUser.user;
  if (!user) {
    throw new ForbiddenException("authenticated user is required");
  }
  if (user.role !== "admin") {
    throw new ForbiddenException("admin role is required");
  }
  return user;
}

function requireSecureWrite(request: RequestWithUser): void {
  if (request.secure || request.protocol === "https" || isLoopback(request.ip ?? request.socket?.remoteAddress)) {
    return;
  }
  throw new ForbiddenException("AI model configuration writes require HTTPS");
}

function isLoopback(address: string | undefined): boolean {
  const normalized = address?.trim().toLowerCase();
  return normalized === "::1" || normalized === "127.0.0.1" || normalized === "::ffff:127.0.0.1";
}

function mapModelErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(operation()).catch((error) => Promise.reject(toHttpError(error)));
  } catch (error) {
    return Promise.reject(toHttpError(error));
  }
}

function toHttpError(error: unknown): unknown {
  if (!(error instanceof AiModelError)) {
    return error;
  }
  return new BadRequestException({
    statusCode: 400,
    code: error.code,
    message: error.code
  });
}
