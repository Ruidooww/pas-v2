import { Body, Controller, ForbiddenException, Get, Inject, Patch, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SYSTEM_SERVICE } from "./system.tokens";
import { SystemService } from "./system.service";
import type { LoginBranding, SystemOverview, UpdateLoginBrandingRequest } from "./system.types";

type RequestWithUser = {
  user?: AuthenticatedUser;
};

@Controller()
export class SystemController {
  constructor(@Inject(SYSTEM_SERVICE) private readonly systemService: SystemService) {}

  @Get("api/internal/system/overview")
  getOverview(@Req() requestOrUser: RequestWithUser | AuthenticatedUser): Promise<SystemOverview> {
    requireAdmin(requestOrUser);
    return this.systemService.getOverview();
  }

  @Get("api/branding/login")
  getLoginBranding(): Promise<LoginBranding> {
    return this.systemService.getLoginBranding();
  }

  @Patch("api/internal/system/branding")
  updateLoginBranding(
    @Req() requestOrUser: RequestWithUser | AuthenticatedUser,
    @Body() body: UpdateLoginBrandingRequest
  ): Promise<LoginBranding> {
    const user = requireAdmin(requestOrUser);
    return this.systemService.updateLoginBranding(user.userId, body ?? {});
  }
}

function requireAdmin(requestOrUser: RequestWithUser | AuthenticatedUser): AuthenticatedUser {
  const user = resolveUser(requestOrUser);
  if (user.role !== "admin") {
    throw new ForbiddenException("admin role is required");
  }
  return user;
}

function resolveUser(requestOrUser: RequestWithUser | AuthenticatedUser): AuthenticatedUser {
  if ("role" in requestOrUser) {
    return requestOrUser;
  }

  if (!requestOrUser.user) {
    throw new ForbiddenException("authenticated user is required");
  }
  return requestOrUser.user;
}
