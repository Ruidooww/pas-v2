import type { ReactNode } from "react";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  HomeOutlined,
  SettingOutlined,
  TeamOutlined
} from "@ant-design/icons";
import type {
  EffectivePrimaryMenuItem,
  EffectiveSecondaryMenuItem,
  PrimaryMenuDefinition,
  PrimaryMenuKey,
  PublicUser,
  SecondaryMenuKey
} from "./types";

export type View =
  | "workbenchOverview"
  | "workbenchMyTasks"
  | "workbenchTeamTasks"
  | "customerManagement"
  | "customerInsights"
  | "proposalTasks"
  | "proposalLibrary"
  | "feedback"
  | "qa"
  | "business"
  | "platform"
  | "platformGovernance"
  | "knowledge"
  | "documents"
  | "templates"
  | "accounts"
  | "auditLogs"
  | "dataAttachments"
  | "systemSettings"
  | "menuConfig";

const DEFAULT_MENU: PrimaryMenuDefinition[] = [
  {
    key: "workbench",
    label: "工作台",
    icon: "home",
    order: 10,
    children: [
      { key: "overview", label: "总览看板", route: "/workbench/overview", roles: ["sales", "presales", "admin"], order: 10 },
      { key: "my_tasks", label: "我的待办", route: "/workbench/my-tasks", roles: ["sales", "presales", "admin"], order: 20 },
      { key: "team_tasks", label: "团队任务", route: "/workbench/team-tasks", roles: ["presales", "admin"], order: 30 }
    ]
  },
  {
    key: "customers",
    label: "客户作战",
    icon: "customer",
    order: 20,
    children: [
      { key: "customer_management", label: "客户管理", route: "/customers", roles: ["sales", "presales", "admin"], order: 10 },
      { key: "customer_insights", label: "客户画像", route: "/customers/insights", roles: ["sales", "presales", "admin"], order: 20 },
      { key: "opportunities", label: "商机推进", route: "/business/opportunities", roles: ["sales", "presales", "admin"], order: 30 },
      { key: "meeting_minutes", label: "会议纪要", route: "/business/meetings", roles: ["sales", "presales", "admin"], order: 40 },
      { key: "contracts_after_sales", label: "合同售后", route: "/business/contracts-after-sales", roles: ["presales", "admin"], order: 50 }
    ]
  },
  {
    key: "knowledge_delivery",
    label: "方案生产",
    icon: "knowledge",
    order: 30,
    children: [
      { key: "proposal_tasks", label: "方案生成", route: "/proposals/tasks", roles: ["presales", "admin"], order: 10 },
      { key: "qa", label: "知识问答", route: "/knowledge/qa", roles: ["sales", "presales", "admin"], order: 20 },
      { key: "export_jobs", label: "导出中心", route: "/delivery/exports", roles: ["presales", "admin"], order: 30 },
      { key: "proposal_library", label: "方案库", route: "/proposals/library", roles: ["presales", "admin"], order: 40 }
    ]
  },
  {
    key: "business_loop",
    label: "知识与模板",
    icon: "business",
    order: 40,
    children: [
      { key: "documents", label: "文档运营", route: "/knowledge/documents", roles: ["presales", "admin"], order: 10 },
      { key: "knowledge_blocks", label: "知识块审核", route: "/knowledge/blocks", roles: ["presales", "admin"], order: 20 },
      { key: "templates", label: "模板运营", route: "/delivery/templates", roles: ["presales", "admin"], order: 30 },
      { key: "customer_feedback", label: "反馈闭环", route: "/business/feedback", roles: ["sales", "presales", "admin"], order: 40 }
    ]
  },
  {
    key: "analytics_ops",
    label: "运营分析",
    icon: "analytics",
    order: 50,
    children: [
      { key: "analytics", label: "运营总览", route: "/platform/analytics", roles: ["presales", "admin"], order: 10 }
    ]
  },
  {
    key: "system",
    label: "系统设置",
    icon: "system",
    order: 60,
    children: [
      { key: "account_management", label: "账号权限", route: "/system/accounts", roles: ["admin"], order: 10 },
      { key: "audit_logs", label: "审计日志", route: "/system/audit-logs", roles: ["admin"], order: 20 },
      { key: "data_attachments", label: "数据与附件", route: "/system/data-attachments", roles: ["admin"], order: 30 },
      { key: "secondary_menu_config", label: "菜单配置", route: "/system/secondary-menu", roles: ["admin"], order: 40 },
      { key: "system_settings", label: "运行配置", route: "/system/settings", roles: ["admin"], order: 50 },
      { key: "platform_governance", label: "平台接入", route: "/platform/governance", roles: ["admin"], order: 60 }
    ]
  }
];

export function fallbackMenuFor(user: PublicUser): EffectivePrimaryMenuItem[] {
  return DEFAULT_MENU.map((primary) => {
    const children = primary.children
      .filter((child) => child.roles.includes(user.role))
      .sort(sortByOrder)
      .map((child, index) => ({ ...child, visible: true as const, isDefault: index === 0 }));

    if (children.length === 0) {
      return undefined;
    }
    const firstChild = children[0];
    if (!firstChild) {
      return undefined;
    }

    return {
      key: primary.key,
      label: primary.label,
      icon: primary.icon,
      order: primary.order,
      children,
      defaultSecondaryKey: firstChild.key
    };
  })
    .filter((primary): primary is EffectivePrimaryMenuItem => primary !== undefined)
    .sort(sortByOrder);
}

export function buildAntMenuItems(menu: EffectivePrimaryMenuItem[]): MenuProps["items"] {
  return menu.map((primary) => ({
    key: primaryKeyToMenuKey(primary.key),
    icon: menuIcon(primary.icon),
    label: primary.label,
    children: primary.children.map((child) => ({
      key: child.key,
      label: child.label
    }))
  }));
}

export function buildPrimaryMenuItems(menu: EffectivePrimaryMenuItem[]): MenuProps["items"] {
  return menu.map((primary) => ({
    key: primaryKeyToMenuKey(primary.key),
    icon: menuIcon(primary.icon),
    label: primary.label
  }));
}

export function menuIcon(icon: string): ReactNode {
  switch (icon) {
    case "home":
      return <HomeOutlined />;
    case "business":
      return <DatabaseOutlined />;
    case "knowledge":
      return <FileDoneOutlined />;
    case "analytics":
      return <BarChartOutlined />;
    case "platform":
      return <ClusterOutlined />;
    case "system":
      return <SettingOutlined />;
    case "customer":
      return <TeamOutlined />;
    default:
      return <AppstoreOutlined />;
  }
}

export function routeToView(route: string): View {
  if (route === "/workbench/overview") return "workbenchOverview";
  if (route === "/workbench/my-tasks") return "workbenchMyTasks";
  if (route === "/workbench/team-tasks") return "workbenchTeamTasks";
  if (route === "/customers") return "customerManagement";
  if (route === "/customers/insights") return "customerInsights";
  if (route === "/proposals/tasks") return "proposalTasks";
  if (route === "/proposals/library") return "proposalLibrary";
  if (route === "/business/feedback") return "feedback";
  if (route === "/knowledge/qa") return "qa";
  if (route === "/knowledge/documents") return "documents";
  if (route === "/knowledge/blocks") return "knowledge";
  if (route.startsWith("/delivery/")) return "templates";
  if (route.startsWith("/business/")) return "business";
  if (route === "/platform/analytics") return "platform";
  if (route.startsWith("/platform/")) return "platformGovernance";
  if (route === "/system/accounts") return "accounts";
  if (route === "/system/audit-logs") return "auditLogs";
  if (route === "/system/data-attachments") return "dataAttachments";
  if (route === "/system/settings") return "systemSettings";
  if (route === "/system/secondary-menu") return "menuConfig";
  return "workbenchOverview";
}

export function viewToTitle(view: View): string {
  switch (view) {
    case "workbenchOverview":
      return "总览看板";
    case "workbenchMyTasks":
      return "我的待办";
    case "workbenchTeamTasks":
      return "团队任务";
    case "customerManagement":
      return "客户管理";
    case "customerInsights":
      return "客户画像";
    case "proposalTasks":
      return "方案生成";
    case "proposalLibrary":
      return "方案库";
    case "feedback":
      return "反馈闭环";
    case "qa":
      return "知识库问答";
    case "business":
      return "客户作战";
    case "platform":
      return "运营分析";
    case "platformGovernance":
      return "平台接入";
    case "knowledge":
      return "知识块审核";
    case "documents":
      return "文档运营";
    case "templates":
      return "模板运营";
    case "accounts":
      return "账号权限";
    case "auditLogs":
      return "审计日志";
    case "dataAttachments":
      return "数据与附件";
    case "systemSettings":
      return "系统设置";
    case "menuConfig":
      return "菜单配置";
    default:
      return "工作台";
  }
}

export function firstSecondaryKey(menu: EffectivePrimaryMenuItem[]): SecondaryMenuKey | null {
  return menu[0]?.defaultSecondaryKey ?? menu[0]?.children[0]?.key ?? null;
}

export function findSecondary(
  menu: EffectivePrimaryMenuItem[],
  key: SecondaryMenuKey | null
): EffectiveSecondaryMenuItem | undefined {
  if (!key) return undefined;
  return menu.flatMap((primary) => primary.children).find((child) => child.key === key);
}

export function findPrimaryBySecondary(
  menu: EffectivePrimaryMenuItem[],
  key: SecondaryMenuKey | null
): EffectivePrimaryMenuItem | undefined {
  if (!key) return undefined;
  return menu.find((primary) => primary.children.some((child) => child.key === key));
}

export function defaultSecondaryForPrimary(
  menu: EffectivePrimaryMenuItem[],
  primaryKey: PrimaryMenuKey
): SecondaryMenuKey | null {
  const primary = menu.find((item) => item.key === primaryKey);
  return primary?.defaultSecondaryKey ?? primary?.children[0]?.key ?? null;
}

export function menuKeyToPrimaryKey(key: string): PrimaryMenuKey | null {
  return key.startsWith("primary:") ? (key.slice("primary:".length) as PrimaryMenuKey) : null;
}

export function primaryKeyToMenuKey(key: PrimaryMenuKey): string {
  return `primary:${key}`;
}

function sortByOrder<T extends { order: number; key: string }>(left: T, right: T): number {
  return left.order === right.order ? left.key.localeCompare(right.key) : left.order - right.order;
}
