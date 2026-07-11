CREATE TABLE "ai_model_configurations" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "api_key_iv" TEXT NOT NULL,
    "api_key_auth_tag" TEXT NOT NULL,
    "timeout_ms" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_test_status" TEXT NOT NULL,
    "last_tested_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_configurations_pkey" PRIMARY KEY ("id")
);
