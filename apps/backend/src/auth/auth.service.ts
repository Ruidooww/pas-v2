import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type {
  AuthenticatedUser,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  PublicUser,
  UserRecord
} from "./auth.types";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordHasher } from "./password-hasher";
import { InMemoryUserStore, UserAlreadyExistsError } from "./user-store.service";

export class AuthService {
  constructor(
    private readonly userStore: InMemoryUserStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtTokenService: JwtTokenService,
    private readonly auditLog: AuditLogService
  ) {}

  async bootstrapAdmin(request: Omit<CreateUserRequest, "role">): Promise<PublicUser> {
    // Idempotent: with persistence hydration the bootstrap admin may already
    // exist on restart — reuse it instead of failing application boot.
    const existing = this.userStore.findByUsername(request.username);
    if (existing) {
      return toPublicUser(existing);
    }

    const passwordHash = await this.passwordHasher.hash(request.password);
    const user = this.userStore.createUser(
      {
        ...request,
        role: "admin"
      },
      passwordHash
    );
    return toPublicUser(user);
  }

  async createUser(actor: AuthenticatedUser, request: CreateUserRequest): Promise<PublicUser> {
    if (actor.role !== "admin") {
      this.auditLog.record({
        action: "user_created",
        actorUserId: actor.userId,
        objectType: "user",
        objectId: request.username,
        result: "failure",
        failureReason: "INSUFFICIENT_ROLE"
      });
      throw new ForbiddenException("admin role is required");
    }

    try {
      const passwordHash = await this.passwordHasher.hash(request.password);
      const user = this.userStore.createUser(request, passwordHash);
      this.auditLog.record({
        action: "user_created",
        actorUserId: actor.userId,
        objectType: "user",
        objectId: user.userId,
        result: "success"
      });
      return toPublicUser(user);
    } catch (error) {
      if (error instanceof UserAlreadyExistsError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async importUsers(actor: AuthenticatedUser, requests: CreateUserRequest[]): Promise<PublicUser[]> {
    const users: PublicUser[] = [];
    for (const request of requests) {
      users.push(await this.createUser(actor, request));
    }
    this.auditLog.record({
      action: "user_imported",
      actorUserId: actor.userId,
      objectType: "user_batch",
      objectId: String(users.length),
      result: "success"
    });
    return users;
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    const user = this.userStore.findByUsername(request.username);
    const passwordOk = user ? await this.passwordHasher.verify(request.password, user.passwordHash) : false;
    if (!user || !user.active || !passwordOk) {
      this.auditLog.record({
        action: "login",
        objectType: "auth_session",
        objectId: request.username.trim().toLowerCase(),
        result: "failure",
        failureReason: "INVALID_CREDENTIALS"
      });
      throw new UnauthorizedException("invalid credentials");
    }

    const publicUser = toPublicUser(user);
    this.auditLog.record({
      action: "login",
      actorUserId: user.userId,
      objectType: "auth_session",
      objectId: user.userId,
      result: "success"
    });
    return {
      accessToken: this.jwtTokenService.sign(publicUser),
      tokenType: "Bearer",
      expiresInSeconds: this.jwtTokenService.expiresInSeconds,
      user: publicUser
    };
  }

  async getMe(accessToken: string): Promise<PublicUser> {
    const payload = this.jwtTokenService.verify(accessToken);
    const user = this.userStore.findById(payload.sub);
    if (!user || !user.active) {
      throw new UnauthorizedException("invalid token");
    }

    return toPublicUser(user);
  }

  async authenticateAuthorizationHeader(header: string | undefined): Promise<PublicUser> {
    const token = parseBearerToken(header);
    return this.getMe(token);
  }
}

function parseBearerToken(header: string | undefined): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new UnauthorizedException("bearer token is required");
  }
  return match[1];
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active
  };
}
