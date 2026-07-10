import { Module } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import { AuditModule } from "../audit/audit.module";
import { AUDIT_LOG } from "../audit/audit.tokens";
import { PersistenceModule } from "../persistence/persistence.module";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import { OrganizationStoreService } from "./organization-store.service";
import { ORGANIZATION_SERVICE, ORGANIZATION_STORE } from "./organization.tokens";
import { createDefaultOrganizationState } from "./organization.types";

@Module({
  controllers: [OrganizationController],
  imports: [AuditModule, PersistenceModule],
  providers: [
    {
      provide: ORGANIZATION_STORE,
      useFactory: async (sink: PersistenceSink): Promise<OrganizationStoreService> => {
        const store = new OrganizationStoreService(sink);
        const persisted = await sink.loadOrganizationState();
        const state = persisted ?? createDefaultOrganizationState();
        store.seed(state);
        if (!persisted) sink.mirrorOrganizationState(state);
        return store;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: ORGANIZATION_SERVICE,
      useFactory: (store: OrganizationStoreService, auditLog: AuditLogService): OrganizationService =>
        new OrganizationService(store, auditLog),
      inject: [ORGANIZATION_STORE, AUDIT_LOG]
    }
  ],
  exports: [ORGANIZATION_SERVICE]
})
export class OrganizationModule {}
