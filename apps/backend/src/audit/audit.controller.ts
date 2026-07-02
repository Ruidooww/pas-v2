import { Controller, ForbiddenException, Get, Inject, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AuditLogService } from "./audit-log.service";
import { AUDIT_LOG } from "./audit.tokens";
import type { AuditEvent } from "./audit.types";

type RequestWithUser = {
  user?: AuthenticatedUser;
};

@Controller()
export class AuditController {
  constructor(@Inject(AUDIT_LOG) private readonly auditLog: AuditLogService) {}

  @Get("api/internal/audit/events")
  list(@Req() requestOrUser: RequestWithUser | AuthenticatedUser): AuditEvent[] {
    const user = resolveUser(requestOrUser);
    if (user.role !== "admin") {
      throw new ForbiddenException("admin role is required");
    }

    return this.auditLog.list();
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
