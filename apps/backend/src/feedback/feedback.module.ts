import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AUDIT_LOG } from "../audit/audit.tokens";
import type { AuditLogService } from "../audit/audit-log.service";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { FEEDBACK_SERVICE, REGRESSION_SERVICE } from "./feedback.tokens";
import { RegressionController } from "./regression.controller";
import { RegressionService } from "./regression.service";

@Module({
  controllers: [FeedbackController, RegressionController],
  imports: [AuditModule],
  providers: [
    {
      provide: FEEDBACK_SERVICE,
      useFactory: (auditLog: AuditLogService): FeedbackService => new FeedbackService(auditLog),
      inject: [AUDIT_LOG]
    },
    {
      provide: REGRESSION_SERVICE,
      useFactory: (auditLog: AuditLogService): RegressionService => new RegressionService(auditLog),
      inject: [AUDIT_LOG]
    }
  ],
  exports: [FEEDBACK_SERVICE, REGRESSION_SERVICE]
})
export class FeedbackModule {}
