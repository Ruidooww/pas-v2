CREATE TABLE "platform_state_snapshots" (
    "snapshot_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_state_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

CREATE INDEX "platform_state_snapshots_updated_at_idx" ON "platform_state_snapshots"("updated_at");
