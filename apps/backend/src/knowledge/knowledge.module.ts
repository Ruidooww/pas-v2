import { Module } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import { AuditModule } from "../audit/audit.module";
import { AUDIT_LOG } from "../audit/audit.tokens";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { PERSISTENCE_SINK } from "../persistence/persistence.tokens";
import { KnowledgeDocumentController } from "./knowledge-document.controller";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import { KnowledgeBlockController } from "./knowledge.controller";
import { KnowledgeBlockService } from "./knowledge.service";
import { KNOWLEDGE_BLOCK_SERVICE, KNOWLEDGE_DOCUMENT_SERVICE } from "./knowledge.tokens";

@Module({
  controllers: [KnowledgeBlockController, KnowledgeDocumentController],
  imports: [AuditModule],
  providers: [
    {
      provide: KNOWLEDGE_BLOCK_SERVICE,
      useFactory: async (auditLog: AuditLogService, sink: PersistenceSink): Promise<KnowledgeBlockService> => {
        const service = new KnowledgeBlockService(auditLog, sink);
        service.seed(await sink.loadKnowledgeBlocks());
        return service;
      },
      inject: [AUDIT_LOG, PERSISTENCE_SINK]
    },
    {
      provide: KNOWLEDGE_DOCUMENT_SERVICE,
      useFactory: async (auditLog: AuditLogService, sink: PersistenceSink): Promise<KnowledgeDocumentService> => {
        const service = new KnowledgeDocumentService(auditLog, sink);
        service.seed(await sink.loadKnowledgeDocuments());
        return service;
      },
      inject: [AUDIT_LOG, PERSISTENCE_SINK]
    }
  ],
  exports: [KNOWLEDGE_BLOCK_SERVICE, KNOWLEDGE_DOCUMENT_SERVICE]
})
export class KnowledgeModule {}
