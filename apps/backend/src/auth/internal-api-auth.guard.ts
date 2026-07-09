import { CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { resolveAccessToken } from "./auth-session";
import { AuthService } from "./auth.service";

type RequestWithAuth = {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: {
    authorization?: string;
    cookie?: string;
    "x-csrf-token"?: string;
  };
  user?: unknown;
};

export class InternalApiAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const url = request.originalUrl || request.url || "";
    if (!requiresAuthentication(url)) {
      return true;
    }

    try {
      request.user = await this.authService.getMe(resolveAccessToken(request));
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("authentication failed");
    }
  }
}

function requiresAuthentication(url: string): boolean {
  const [path = ""] = url.split("?");
  return path.startsWith("/api/internal") || path.startsWith("/api/crm") || path === "/api/ragflow/search";
}
