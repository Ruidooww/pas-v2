CREATE TABLE "business_flow_record_snapshots" (
  "record_id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_flow_record_snapshots_pkey" PRIMARY KEY ("record_id")
);

CREATE INDEX "business_flow_record_snapshots_owner_user_id_idx" ON "business_flow_record_snapshots"("owner_user_id");
CREATE INDEX "business_flow_record_snapshots_kind_idx" ON "business_flow_record_snapshots"("kind");
CREATE INDEX "business_flow_record_snapshots_status_idx" ON "business_flow_record_snapshots"("status");
CREATE INDEX "business_flow_record_snapshots_source_system_idx" ON "business_flow_record_snapshots"("source_system");
