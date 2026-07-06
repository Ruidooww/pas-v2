export type UserRole = "sales" | "presales" | "admin";

export type AuthenticatedUser = {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
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
};

export type UpdateUserRequest = {
  displayName?: string;
  role?: UserRole;
  active?: boolean;
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
