import type { FeishuIntegrationConfig } from "./feishu.types";

export function createFeishuIntegrationConfig(): FeishuIntegrationConfig {
  return {
    enabled: process.env.FEISHU_BOT_ENABLED === "true",
    webhookSecret: process.env.FEISHU_WEBHOOK_SECRET?.trim() || ""
  };
}
