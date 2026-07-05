-- V1 snapshot tables for in-memory hot-path hydration.

CREATE TABLE IF NOT EXISTS "knowledge_block_snapshots" (
    "block_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_block_snapshots_pkey" PRIMARY KEY ("block_id")
);

CREATE INDEX IF NOT EXISTS "knowledge_block_snapshots_owner_user_id_idx" ON "knowledge_block_snapshots"("owner_user_id");
CREATE INDEX IF NOT EXISTS "knowledge_block_snapshots_status_idx" ON "knowledge_block_snapshots"("status");

CREATE TABLE IF NOT EXISTS "knowledge_document_snapshots" (
    "document_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "parse_status" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_document_snapshots_pkey" PRIMARY KEY ("document_id")
);

CREATE INDEX IF NOT EXISTS "knowledge_document_snapshots_owner_user_id_idx" ON "knowledge_document_snapshots"("owner_user_id");
CREATE INDEX IF NOT EXISTS "knowledge_document_snapshots_parse_status_idx" ON "knowledge_document_snapshots"("parse_status");
CREATE INDEX IF NOT EXISTS "knowledge_document_snapshots_enabled_idx" ON "knowledge_document_snapshots"("enabled");

CREATE TABLE IF NOT EXISTS "export_template_snapshots" (
    "template_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_template_snapshots_pkey" PRIMARY KEY ("template_id")
);

CREATE INDEX IF NOT EXISTS "export_template_snapshots_owner_user_id_idx" ON "export_template_snapshots"("owner_user_id");
CREATE INDEX IF NOT EXISTS "export_template_snapshots_format_idx" ON "export_template_snapshots"("format");
CREATE INDEX IF NOT EXISTS "export_template_snapshots_status_idx" ON "export_template_snapshots"("status");
