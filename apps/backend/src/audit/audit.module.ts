import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditLogService } from "./audit-log.service";
import { AUDIT_LOG } from "./audit.tokens";

@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_LOG,
      useFactory: (): AuditLogService => new AuditLogService()
    }
  ],
  exports: [AUDIT_LOG]
})
export class AuditModule {}
