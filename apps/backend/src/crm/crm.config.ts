export type CrmClientMode = "mock" | "external";

export type CrmConfig = {
  clientMode: CrmClientMode;
};

type CrmEnv = Partial<Record<string, string>>;

export function createCrmConfig(env: CrmEnv = process.env): CrmConfig {
  return {
    clientMode: env.CRM_CLIENT_MODE?.trim() === "external" ? "external" : "mock"
  };
}
