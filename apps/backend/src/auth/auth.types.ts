import type { OrganizationRole } from "../organization/organization.types";

export type UserRole = OrganizationRole;

export type AuthenticatedUser = {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  organizationUnitId: string;
  projectGroupIds: string[];
};

export type UserRecord = AuthenticatedUser & {
  passwordHash: string;
  active: boolean;
  createdAt: string;
};

export type PublicUser = AuthenticatedUser & {
  active: boolean;
};

export type CreateUserRequest = {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  organizationUnitId?: string;
  projectGroupIds?: string[];
};

export type UpdateUserRequest = {
  displayName?: string;
  role?: UserRole;
  active?: boolean;
  organizationUnitId?: string;
  projectGroupIds?: string[];
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: PublicUser;
};

export type JwtConfig = {
  secret: string;
  expiresInSeconds: number;
};

export type JwtPayload = AuthenticatedUser & {
  sub: string;
  exp: number;
};
