ALTER TABLE "users"
  ADD COLUMN "organization_unit_id" TEXT,
  ADD COLUMN "project_group_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "users"
SET "organization_unit_id" = CASE
  WHEN "role" = 'presales' THEN 'org-technical-presales'
  WHEN "role" = 'sales' THEN 'org-sales'
  ELSE 'org-company'
END;

UPDATE "users"
SET "role" = 'technical'
WHERE "role" = 'presales';

CREATE TABLE "organization_state_snapshots" (
  "snapshot_id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_state_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

CREATE INDEX "organization_state_snapshots_updated_at_idx"
  ON "organization_state_snapshots"("updated_at");
