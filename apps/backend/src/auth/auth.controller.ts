import { BadRequestException, Body, Controller, Get, Headers, Inject, Post, Req } from "@nestjs/common";
import { AUTH_SERVICE } from "./auth.tokens";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser, CreateUserRequest, LoginRequest, LoginResponse, PublicUser } from "./auth.types";

type RequestWithUser = {
  user?: AuthenticatedUser;
};

@Controller()
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: AuthService) {}

  @Post("api/auth/login")
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    if (!body.username?.trim() || !body.password) {
      throw new BadRequestException("username and password are required");
    }

    return this.authService.login(body);
  }

  @Get("api/me")
  async me(@Headers("authorization") authorization?: string): Promise<PublicUser> {
    return this.authService.authenticateAuthorizationHeader(authorization);
  }

  @Post("api/internal/auth/users")
  async createUser(@Req() request: RequestWithUser, @Body() body: CreateUserRequest): Promise<PublicUser> {
    return this.authService.createUser(requireUser(request), body);
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
