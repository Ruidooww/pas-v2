import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PLATFORM_SERVICE } from "./platform.tokens";
import type { PlatformService } from "./platform.service";
import type {
  DashboardSnapshot,
  DetectCipSignalsRequest,
  ImportSkillRequest,
  PlatformOverview,
  RegisterProductRequest,
  RouteMessageRequest,
  RouteMessageResult,
  RunWorkflowRequest,
  SecurityReport
} from "./platform.types";

type RequestWithUser = {
  user: AuthenticatedUser;
};

@Controller("api/internal/platform")
export class PlatformController {
  constructor(@Inject(PLATFORM_SERVICE) private readonly service: PlatformService) {}

  @Get("overview")
  getOverview(@Req() request: RequestWithUser): PlatformOverview {
    return this.service.getOverview(request.user);
  }

  @Get("dashboard")
  getDashboard(
    @Req() request: RequestWithUser,
    @Query("department") department?: string,
    @Query("product") product?: string,
    @Query("channel") channel?: string
  ): DashboardSnapshot {
    return this.service.getDashboard(
      {
        department: normalizeOptional(department),
        product: normalizeOptional(product),
        channel: normalizeOptional(channel)
      },
      request.user
    );
  }

  @Get("security-report")
  getSecurityReport(@Req() request: RequestWithUser): SecurityReport {
    return this.service.getSecurityReport(request.user);
  }

  @Post("channels/messages")
  routeMessage(@Req() request: RequestWithUser, @Body() body: RouteMessageRequest): RouteMessageResult {
    requireText(body.channel, "channel is required");
    requireText(body.externalUserId, "externalUserId is required");
    requireText(body.text, "text is required");
    return this.service.routeMessage(
      {
        channel: body.channel,
        externalUserId: body.externalUserId.trim(),
        text: body.text.trim(),
        sourceRef: normalizeSourceRef(body.sourceRef)
      },
      request.user
    );
  }

  @Post("skills/import")
  importSkill(@Req() request: RequestWithUser, @Body() body: ImportSkillRequest) {
    requireText(body.name, "name is required");
    requireText(body.description, "description is required");
    requireText(body.packageManifest, "packageManifest is required");
    return this.service.importSkill(
      {
        name: body.name.trim(),
        description: body.description.trim(),
        requestedScopes: Array.isArray(body.requestedScopes) ? body.requestedScopes : [],
        packageManifest: body.packageManifest.trim()
      },
      request.user
    );
  }

  @Patch("skills/:skillId/approve")
  approveSkill(@Req() request: RequestWithUser, @Param("skillId") skillId: string) {
    requireText(skillId, "skillId is required");
    return this.service.approveSkill(skillId, request.user);
  }

  @Post("workflows/:workflowId/run")
  runWorkflow(
    @Req() request: RequestWithUser,
    @Param("workflowId") workflowId: string,
    @Body() body: Pick<RunWorkflowRequest, "input">
  ) {
    requireText(workflowId, "workflowId is required");
    if (!body.input || typeof body.input !== "object") {
      throw new BadRequestException("input is required");
    }
    return this.service.runWorkflow({ workflowId, input: body.input }, request.user);
  }

  @Post("products/register")
  registerProduct(@Req() request: RequestWithUser, @Body() body: RegisterProductRequest) {
    requireText(body.name, "name is required");
    requireText(body.version, "version is required");
    requireText(body.ownerTeam, "ownerTeam is required");
    return this.service.registerProduct(
      {
        ...body,
        name: body.name.trim(),
        version: body.version.trim(),
        ownerTeam: body.ownerTeam.trim()
      },
      request.user
    );
  }

  @Post("cip/signals")
  detectCipSignals(@Req() request: RequestWithUser, @Body() body: DetectCipSignalsRequest) {
    requireText(body.customerId, "customerId is required");
    requireText(body.customerName, "customerName is required");
    requireText(body.evidenceText, "evidenceText is required");
    return this.service.detectCipSignals(
      {
        customerId: body.customerId.trim(),
        customerName: body.customerName.trim(),
        evidenceText: body.evidenceText.trim()
      },
      request.user
    );
  }

  @Get("tenant")
  getTenantReservation(@Req() request: RequestWithUser) {
    return this.service.getTenantReservation(request.user);
  }
}

function requireText(value: string | undefined, message: string): void {
  if (!value?.trim()) {
    throw new BadRequestException(message);
  }
}

function normalizeSourceRef(value: string | undefined): string {
  return value?.trim() || "v3-console";
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
