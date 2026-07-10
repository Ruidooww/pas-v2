import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { OrganizationService } from "../organization/organization.service";
import { DEFAULT_ORGANIZATION_UNIT_IDS } from "../organization/organization.types";
import type {
  AuthenticatedUser,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  PublicUser,
  UpdateUserRequest,
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
    private readonly auditLog: AuditLogService,
    private readonly organizationService: OrganizationService
  ) {}

  async bootstrapAdmin(request: Omit<CreateUserRequest, "role">): Promise<PublicUser> {
    // Idempotent: with persistence hydration the bootstrap admin may already
    // exist on restart — reuse it instead of failing application boot.
    const existing = this.userStore.findByUsername(request.username);
    if (existing) {
      return toPublicUser(existing);
    }

    const passwordHash = await this.passwordHasher.hash(request.password);
    const membership = this.resolveMembership(
      "admin",
      request.organizationUnitId,
      request.projectGroupIds
    );
    const user = this.userStore.createUser(
      {
        ...request,
        role: "admin",
        ...membership
      },
      passwordHash
    );
    return toPublicUser(user);
  }

  async createUser(actor: AuthenticatedUser, request: CreateUserRequest): Promise<PublicUser> {
    this.requireAdmin(actor, "user_created", request.username);

    try {
      const passwordHash = await this.passwordHasher.hash(request.password);
      const membership = this.resolveMembership(
        request.role,
        request.organizationUnitId,
        request.projectGroupIds
      );
      const user = this.userStore.createUser({ ...request, ...membership }, passwordHash);
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

  listUsers(actor: AuthenticatedUser): PublicUser[] {
    this.requireAdmin(actor, "user_listed", "list");
    return this.userStore
      .listUsers()
      .map(toPublicUser)
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  updateUser(actor: AuthenticatedUser, userId: string, request: UpdateUserRequest): PublicUser {
    this.requireAdmin(actor, "user_updated", userId);
    const current = this.userStore.findById(userId);
    if (!current) {
      throw new NotFoundException("user not found");
    }

    if (
      request.role === undefined &&
      request.active === undefined &&
      request.displayName === undefined &&
      request.organizationUnitId === undefined &&
      request.projectGroupIds === undefined
    ) {
      throw new BadRequestException("at least one user field is required");
    }

    this.assertActiveAdminRemains(current, request);
    const nextRole = request.role ?? current.role;
    const roleChanged = request.role !== undefined && request.role !== current.role;
    const membership = this.resolveMembership(
      nextRole,
      request.organizationUnitId ?? (roleChanged ? defaultOrganizationUnitId(nextRole) : current.organizationUnitId),
      request.projectGroupIds ?? current.projectGroupIds
    );
    const updated = this.userStore.updateUser(userId, { ...request, ...membership });
    if (!updated) {
      throw new NotFoundException("user not found");
    }
    this.auditLog.record({
      action: "user_updated",
      actorUserId: actor.userId,
      objectType: "user",
      objectId: updated.userId,
      result: "success"
    });
    return toPublicUser(updated);
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
    this.assertActiveRoleMembership(user);

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
    this.assertActiveRoleMembership(user);

    return toPublicUser(user);
  }

  async authenticateAuthorizationHeader(header: string | undefined): Promise<PublicUser> {
    const token = parseBearerToken(header);
    return this.getMe(token);
  }

  private requireAdmin(actor: AuthenticatedUser, action: "user_created" | "user_listed" | "user_updated", objectId: string): void {
    if (actor.role === "admin") {
      return;
    }

    this.auditLog.record({
      action,
      actorUserId: actor.userId,
      objectType: "user",
      objectId,
      result: "failure",
      failureReason: "INSUFFICIENT_ROLE"
    });
    throw new ForbiddenException("admin role is required");
  }

  private assertActiveAdminRemains(current: UserRecord, request: UpdateUserRequest): void {
    const nextRole = request.role ?? current.role;
    const nextActive = request.active ?? current.active;
    if (current.role !== "admin" || !current.active || (nextRole === "admin" && nextActive)) {
      return;
    }

    const remainingActiveAdmins = this.userStore
      .listUsers()
      .filter((user) => user.userId !== current.userId && user.role === "admin" && user.active).length;
    if (remainingActiveAdmins === 0) {
      throw new BadRequestException("at least one active admin is required");
    }
  }

  private resolveMembership(
    role: UserRecord["role"],
    organizationUnitId: string | undefined,
    projectGroupIds: string[] | undefined
  ): Pick<UserRecord, "organizationUnitId" | "projectGroupIds"> {
    const resolved = {
      organizationUnitId: organizationUnitId === undefined ? defaultOrganizationUnitId(role) : organizationUnitId.trim(),
      projectGroupIds: [...new Set((projectGroupIds ?? []).map((item) => item.trim()).filter(Boolean))]
    };
    this.organizationService.validateUserMembership(role, resolved.organizationUnitId, resolved.projectGroupIds);
    return resolved;
  }

  private assertActiveRoleMembership(user: UserRecord): void {
    if (this.organizationService.isActiveRoleMember(user)) return;
    this.auditLog.record({
      action: "login",
      actorUserId: user.userId,
      objectType: "auth_session",
      objectId: user.userId,
      result: "failure",
      failureReason: "INACTIVE_ORGANIZATION_MEMBERSHIP"
    });
    throw new UnauthorizedException("inactive organization membership");
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
    organizationUnitId: user.organizationUnitId,
    projectGroupIds: [...user.projectGroupIds],
    active: user.active
  };
}

function defaultOrganizationUnitId(role: UserRecord["role"]): string {
  if (role === "sales") return DEFAULT_ORGANIZATION_UNIT_IDS.sales;
  if (role === "technical") return DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales;
  return DEFAULT_ORGANIZATION_UNIT_IDS.company;
}
