import { Module } from "@nestjs/common";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { AuditController } from "./audit.controller";
import { AuditLogService } from "./audit-log.service";
import { AUDIT_LOG } from "./audit.tokens";

@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_LOG,
      useFactory: async (sink: PersistenceSink): Promise<AuditLogService> => {
        const service = new AuditLogService(sink);
        service.seed(await sink.loadAuditEvents());
        return service;
      },
      inject: [PERSISTENCE_SINK]
    }
  ],
  exports: [AUDIT_LOG]
})
export class AuditModule {}
