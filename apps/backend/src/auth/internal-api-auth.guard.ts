import { CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

type RequestWithAuth = {
  url?: string;
  originalUrl?: string;
  headers?: {
    authorization?: string;
  };
  user?: unknown;
};

export class InternalApiAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const url = request.originalUrl || request.url || "";
    if (!url.startsWith("/api/internal")) {
      return true;
    }

    try {
      request.user = await this.authService.authenticateAuthorizationHeader(request.headers?.authorization);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("authentication failed");
    }
  }
}
