import { Module } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import { AuditModule } from "../audit/audit.module";
import { AUDIT_LOG } from "../audit/audit.tokens";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { MenuController } from "./menu.controller";
import { MenuService } from "./menu.service";
import { MenuStoreService } from "./menu-store.service";
import { MENU_SERVICE, MENU_STORE } from "./menu.tokens";

@Module({
  controllers: [MenuController],
  imports: [AuditModule],
  providers: [
    {
      provide: MENU_STORE,
      useFactory: async (sink: PersistenceSink): Promise<MenuStoreService> => {
        const store = new MenuStoreService(sink);
        store.seed(await sink.loadMenuState());
        return store;
      },
      inject: [PERSISTENCE_SINK]
    },
    {
      provide: MENU_SERVICE,
      useFactory: (store: MenuStoreService, auditLog: AuditLogService): MenuService =>
        new MenuService(store, auditLog),
      inject: [MENU_STORE, AUDIT_LOG]
    }
  ],
  exports: [MENU_SERVICE]
})
export class MenuModule {}
