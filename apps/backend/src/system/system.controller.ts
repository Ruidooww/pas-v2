import { Controller, ForbiddenException, Get, Inject, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SYSTEM_SERVICE } from "./system.tokens";
import { SystemService } from "./system.service";
import type { SystemOverview } from "./system.types";

type RequestWithUser = {
  user?: AuthenticatedUser;
};

@Controller()
export class SystemController {
  constructor(@Inject(SYSTEM_SERVICE) private readonly systemService: SystemService) {}

  @Get("api/internal/system/overview")
  getOverview(@Req() requestOrUser: RequestWithUser | AuthenticatedUser): Promise<SystemOverview> {
    const user = resolveUser(requestOrUser);
    if (user.role !== "admin") {
      throw new ForbiddenException("admin role is required");
    }

    return this.systemService.getOverview();
  }
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
