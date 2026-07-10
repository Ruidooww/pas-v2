import crypto from "node:crypto";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { DEFAULT_ORGANIZATION_UNIT_IDS } from "../organization/organization.types";
import type { CreateUserRequest, UpdateUserRequest, UserRecord } from "./auth.types";

export class UserAlreadyExistsError extends Error {
  constructor(username: string) {
    super(`User already exists: ${username}`);
    this.name = "UserAlreadyExistsError";
  }
}

export class InMemoryUserStore {
  private readonly usersById = new Map<string, UserRecord>();
  private readonly userIdsByUsername = new Map<string, string>();

  constructor(private readonly sink?: PersistenceSink) {}

  seed(records: UserRecord[]): void {
    for (const record of records) {
      const normalized = normalizeHydratedUser(record);
      if (this.userIdsByUsername.has(normalized.username)) continue;
      this.usersById.set(normalized.userId, normalized);
      this.userIdsByUsername.set(normalized.username, normalized.userId);
    }
  }

  createUser(request: CreateUserRequest, passwordHash: string): UserRecord {
    const username = normalizeUsername(request.username);
    if (this.userIdsByUsername.has(username)) {
      throw new UserAlreadyExistsError(username);
    }

    const user: UserRecord = {
      userId: `user-${crypto.randomUUID()}`,
      username,
      displayName: request.displayName.trim(),
      role: request.role,
      organizationUnitId: request.organizationUnitId ?? defaultOrganizationUnitId(request.role),
      projectGroupIds: normalizeProjectGroupIds(request.projectGroupIds ?? []),
      passwordHash,
      active: true,
      createdAt: new Date().toISOString()
    };
    this.usersById.set(user.userId, user);
    this.userIdsByUsername.set(username, user.userId);
    this.sink?.mirrorUser(user);
    return cloneUser(user);
  }

  findByUsername(username: string): UserRecord | undefined {
    const userId = this.userIdsByUsername.get(normalizeUsername(username));
    const user = userId ? this.usersById.get(userId) : undefined;
    return user ? cloneUser(user) : undefined;
  }

  findById(userId: string): UserRecord | undefined {
    const user = this.usersById.get(userId);
    return user ? cloneUser(user) : undefined;
  }

  listUsers(): UserRecord[] {
    return Array.from(this.usersById.values()).map(cloneUser);
  }

  updateUser(userId: string, request: UpdateUserRequest): UserRecord | undefined {
    const current = this.usersById.get(userId);
    if (!current) {
      return undefined;
    }

    const next: UserRecord = {
      ...current,
      displayName: request.displayName?.trim() || current.displayName,
      role: request.role ?? current.role,
      organizationUnitId: request.organizationUnitId ?? current.organizationUnitId,
      projectGroupIds: request.projectGroupIds
        ? normalizeProjectGroupIds(request.projectGroupIds)
        : current.projectGroupIds,
      active: request.active ?? current.active
    };
    this.usersById.set(userId, next);
    this.sink?.mirrorUser(next);
    return cloneUser(next);
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function cloneUser(user: UserRecord): UserRecord {
  return { ...user, projectGroupIds: [...user.projectGroupIds] };
}

function normalizeHydratedUser(record: UserRecord): UserRecord {
  const legacy = record as Omit<UserRecord, "role" | "organizationUnitId" | "projectGroupIds"> & {
    role: string;
    organizationUnitId?: string;
    projectGroupIds?: string[];
  };
  const role = legacy.role === "presales" ? "technical" : legacy.role;
  if (role !== "sales" && role !== "technical" && role !== "admin") {
    throw new Error(`Unsupported user role: ${legacy.role}`);
  }
  const organizationUnitId =
    legacy.role === "presales"
      ? defaultOrganizationUnitId(role)
      : legacy.organizationUnitId || defaultOrganizationUnitId(role);
  return {
    ...record,
    role,
    organizationUnitId,
    projectGroupIds: normalizeProjectGroupIds(legacy.projectGroupIds ?? [])
  };
}

function defaultOrganizationUnitId(role: UserRecord["role"]): string {
  if (role === "sales") return DEFAULT_ORGANIZATION_UNIT_IDS.sales;
  if (role === "technical") return DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales;
  return DEFAULT_ORGANIZATION_UNIT_IDS.company;
}

function normalizeProjectGroupIds(projectGroupIds: string[]): string[] {
  return [...new Set(projectGroupIds.map((projectGroupId) => projectGroupId.trim()).filter(Boolean))];
}
