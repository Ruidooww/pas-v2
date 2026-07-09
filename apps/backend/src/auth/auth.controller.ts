import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { clearAuthCookies, resolveAccessToken, writeAuthCookies } from "./auth-session";
import { AUTH_SERVICE } from "./auth.tokens";
import { AuthService } from "./auth.service";
import type {
  AuthenticatedUser,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  PublicUser,
  UpdateUserRequest
} from "./auth.types";

type RequestWithUser = {
  method?: string;
  headers?: {
    authorization?: string;
    cookie?: string;
    "x-csrf-token"?: string;
  };
  user?: AuthenticatedUser;
};

type CookieResponse = NonNullable<Parameters<typeof writeAuthCookies>[0]>;

@Controller()
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: AuthService) {}

  @Post("api/auth/login")
  async login(@Body() body: LoginRequest, @Res({ passthrough: true }) response?: CookieResponse): Promise<LoginResponse> {
    if (!body.username?.trim() || !body.password) {
      throw new BadRequestException("username and password are required");
    }

    const login = await this.authService.login(body);
    writeAuthCookies(response, login.accessToken, login.expiresInSeconds);
    return login;
  }

  @Post("api/auth/logout")
  logout(@Res({ passthrough: true }) response: CookieResponse): { ok: true } {
    clearAuthCookies(response);
    return { ok: true };
  }

  @Get("api/me")
  async me(@Req() request: RequestWithUser): Promise<PublicUser> {
    return this.authService.getMe(resolveAccessToken(request));
  }

  @Post("api/internal/auth/users")
  async createUser(@Req() request: RequestWithUser, @Body() body: CreateUserRequest): Promise<PublicUser> {
    return this.authService.createUser(requireUser(request), body);
  }

  @Get("api/internal/auth/users")
  listUsers(@Req() request: RequestWithUser): PublicUser[] {
    return this.authService.listUsers(requireUser(request));
  }

  @Patch("api/internal/auth/users/:userId")
  updateUser(
    @Req() request: RequestWithUser,
    @Param("userId") userId: string,
    @Body() body: UpdateUserRequest
  ): PublicUser {
    return this.authService.updateUser(requireUser(request), userId, body);
  }

  @Post("api/internal/auth/users/import")
  async importUsers(@Req() request: RequestWithUser, @Body() body: { users?: CreateUserRequest[] }): Promise<PublicUser[]> {
    if (!body.users?.length) {
      throw new BadRequestException("users are required");
    }

    return this.authService.importUsers(requireUser(request), body.users);
  }
}

function requireUser(request: RequestWithUser): AuthenticatedUser {
  if (!request.user) {
    throw new BadRequestException("authenticated user is required");
  }

  return request.user;
}
