import { Module } from "@nestjs/common";
import { PersistenceModule } from "../persistence/persistence.module";
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
  imports: [AuditModule, PersistenceModule],
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
      useFactory: async (auditLog: AuditLogService, sink: PersistenceSink): Promise<RegressionService> => {
        const service = new RegressionService(auditLog, sink);
        service.seed(await sink.loadRegressionRuns());
        return service;
      },
      inject: [AUDIT_LOG, PERSISTENCE_SINK]
    }
  ],
  exports: [FEEDBACK_SERVICE, REGRESSION_SERVICE]
})
export class FeedbackModule {}
