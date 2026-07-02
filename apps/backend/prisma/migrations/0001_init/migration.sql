-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "audit_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "proposal_job_snapshots" (
    "job_id" TEXT NOT NULL,
    "user_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_job_snapshots_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "export_job_snapshots" (
    "job_id" TEXT NOT NULL,
    "user_id" TEXT,
    "source_package_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_job_snapshots_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "feedback_snapshots" (
    "feedback_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_snapshots_pkey" PRIMARY KEY ("feedback_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "audit_events_event_idx" ON "audit_events"("event");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events"("occurred_at");

-- CreateIndex
CREATE INDEX "proposal_job_snapshots_user_id_idx" ON "proposal_job_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "proposal_job_snapshots_customer_id_idx" ON "proposal_job_snapshots"("customer_id");

-- CreateIndex
CREATE INDEX "export_job_snapshots_user_id_idx" ON "export_job_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "export_job_snapshots_customer_id_idx" ON "export_job_snapshots"("customer_id");

-- CreateIndex
CREATE INDEX "feedback_snapshots_user_id_idx" ON "feedback_snapshots"("user_id");
