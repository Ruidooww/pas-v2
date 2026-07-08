export type SystemSettingStatus = "configured" | "default" | "enabled" | "disabled" | "missing";

export type SystemSettingItem = {
  group: "ragflow" | "llm" | "storage" | "database" | "export" | "branding";
  key: string;
  label: string;
  value: string;
  status: SystemSettingStatus;
  secret: boolean;
};

export type SystemPathStatus = {
  label: string;
  path: string;
  exists: boolean;
  writable: boolean;
  fileCount: number;
  totalBytes: number;
  truncated: boolean;
};

export type LoginBranding = {
  title: string;
  subtitle: string;
  logoUrl?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type UpdateLoginBrandingRequest = {
  title?: string;
  subtitle?: string;
  logoUrl?: string;
};

export type SystemOverview = {
  generatedAt: string;
  settings: SystemSettingItem[];
  paths: SystemPathStatus[];
  branding: LoginBranding;
};
