import type { UserRole } from "../auth/auth.types";

export type PrimaryMenuKey =
  | "workbench"
  | "customers"
  | "knowledge_delivery"
  | "business_loop"
  | "analytics_ops"
  | "system";

export type SecondaryMenuKey =
  | "overview"
  | "my_tasks"
  | "team_tasks"
  | "customer_management"
  | "customer_insights"
  | "proposal_tasks"
  | "proposal_library"
  | "qa"
  | "documents"
  | "knowledge_blocks"
  | "templates"
  | "export_jobs"
  | "opportunities"
  | "meeting_minutes"
  | "contracts_after_sales"
  | "customer_feedback"
  | "platform_governance"
  | "analytics"
  | "account_management"
  | "audit_logs"
  | "data_attachments"
  | "secondary_menu_config"
  | "system_settings";

export type SecondaryMenuDefinition = {
  key: SecondaryMenuKey;
  label: string;
  route: string;
  roles: UserRole[];
  order: number;
};

export type PrimaryMenuDefinition = {
  key: PrimaryMenuKey;
  label: string;
  icon: string;
  order: number;
  children: SecondaryMenuDefinition[];
};

export type SecondaryMenuOverride = {
  primaryKey: PrimaryMenuKey;
  secondaryKey: SecondaryMenuKey;
  visible: boolean;
  order: number;
  alias?: string;
  roles: UserRole[];
  isDefault?: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type EffectiveSecondaryMenuItem = SecondaryMenuDefinition & {
  visible: true;
  label: string;
  isDefault: boolean;
};

export type EffectivePrimaryMenuItem = Omit<PrimaryMenuDefinition, "children"> & {
  children: EffectiveSecondaryMenuItem[];
  defaultSecondaryKey: SecondaryMenuKey;
};

export type MenuState = {
  stateId: "pas-menu-state";
  overrides: SecondaryMenuOverride[];
  updatedAt: string;
};

export type MenuConfiguration = {
  defaults: PrimaryMenuDefinition[];
  overrides: SecondaryMenuOverride[];
};

export type UpdateSecondaryMenuOverrideRequest = {
  primaryKey: PrimaryMenuKey;
  secondaryKey: SecondaryMenuKey;
  visible?: boolean;
  order?: number;
  alias?: string;
  roles?: UserRole[];
  isDefault?: boolean;
};
