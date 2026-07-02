import { Module } from "@nestjs/common";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
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
      useFactory: async (auditLog: AuditLogService, sink: PersistenceSink): Promise<FeedbackService> => {
        const service = new FeedbackService(auditLog, sink);
        service.seed(await sink.loadFeedback());
        return service;
      },
      inject: [AUDIT_LOG, PERSISTENCE_SINK]
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
