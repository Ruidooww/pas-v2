import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Patch, Post, Req } from "@nestjs/common";
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
