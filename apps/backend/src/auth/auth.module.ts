import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuditModule } from "../audit/audit.module";
import { AUDIT_LOG } from "../audit/audit.tokens";
import type { AuditLogService } from "../audit/audit-log.service";
import { bootstrapConfiguredAdmin } from "./auth.bootstrap";
import { AuthController } from "./auth.controller";
import { createJwtConfig } from "./auth.config";
import { AuthService } from "./auth.service";
import {
  AUTH_BOOTSTRAP,
  AUTH_SERVICE,
  JWT_CONFIG,
  JWT_TOKEN_SERVICE,
  PASSWORD_HASHER,
  USER_STORE
} from "./auth.tokens";
import type { JwtConfig } from "./auth.types";
import { InternalApiAuthGuard } from "./internal-api-auth.guard";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordHasher } from "./password-hasher";
import { InMemoryUserStore } from "./user-store.service";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";

@Module({
  controllers: [AuthController],
  imports: [AuditModule],
  providers: [
    {
      provide: JWT_CONFIG,
      useFactory: (): JwtConfig => createJwtConfig()
    },
    {
      provide: USER_STORE,
      useFactory: async (sink: PersistenceSink): Promise<InMemoryUserStore> => {
        const store = new InMemoryUserStore(sink);
        store.seed(await sink.loadUsers());
        return store;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: PASSWORD_HASHER,
      useFactory: (): PasswordHasher => new PasswordHasher()
    },
    {
      provide: JWT_TOKEN_SERVICE,
      useFactory: (config: JwtConfig): JwtTokenService => new JwtTokenService(config),
      inject: [JWT_CONFIG]
    },
    {
      provide: AUTH_SERVICE,
      useFactory: (
        userStore: InMemoryUserStore,
        passwordHasher: PasswordHasher,
        jwtTokenService: JwtTokenService,
        auditLog: AuditLogService
      ): AuthService => new AuthService(userStore, passwordHasher, jwtTokenService, auditLog),
      inject: [USER_STORE, PASSWORD_HASHER, JWT_TOKEN_SERVICE, AUDIT_LOG]
    },
    {
      provide: AUTH_BOOTSTRAP,
      useFactory: async (authService: AuthService): Promise<boolean> => {
        await bootstrapConfiguredAdmin(authService);
        return true;
      },
      inject: [AUTH_SERVICE]
    },
    {
      provide: APP_GUARD,
      useFactory: (authService: AuthService): InternalApiAuthGuard => new InternalApiAuthGuard(authService),
      inject: [AUTH_SERVICE]
    }
  ],
  exports: [AUTH_SERVICE]
})
export class AuthModule {}
