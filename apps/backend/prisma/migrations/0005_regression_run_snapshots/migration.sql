CREATE TABLE "regression_run_snapshots" (
    "run_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "gate_status" TEXT NOT NULL,
    "can_go_live" BOOLEAN NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regression_run_snapshots_pkey" PRIMARY KEY ("run_id")
);

CREATE INDEX "regression_run_snapshots_created_by_idx" ON "regression_run_snapshots"("created_by");
CREATE INDEX "regression_run_snapshots_gate_status_idx" ON "regression_run_snapshots"("gate_status");
CREATE INDEX "regression_run_snapshots_can_go_live_idx" ON "regression_run_snapshots"("can_go_live");
