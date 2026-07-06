import type { PrimaryMenuDefinition } from "./menu.types";

export const DEFAULT_PRIMARY_MENUS: PrimaryMenuDefinition[] = [
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
    key: "platform_ops",
    label: "平台管理",
    icon: "platform",
    order: 50,
    children: [
      { key: "product_registry", label: "产品与集成", route: "/platform/products", roles: ["admin"], order: 10 },
      { key: "analytics", label: "运营分析", route: "/platform/analytics", roles: ["presales", "admin"], order: 20 },
      { key: "account_management", label: "账号权限", route: "/system/accounts", roles: ["admin"], order: 30 },
      { key: "audit_logs", label: "审计日志", route: "/system/audit-logs", roles: ["admin"], order: 40 },
      { key: "data_attachments", label: "数据与附件", route: "/system/data-attachments", roles: ["admin"], order: 50 },
      { key: "secondary_menu_config", label: "菜单配置", route: "/system/secondary-menu", roles: ["admin"], order: 60 },
      { key: "system_settings", label: "系统设置", route: "/system/settings", roles: ["admin"], order: 70 }
    ]
  },
  {
    key: "system",
    label: "系统底座",
    icon: "system",
    order: 60,
    children: [
      { key: "platform_governance", label: "平台治理", route: "/platform/governance", roles: ["admin"], order: 10 },
      { key: "integration_health", label: "集成健康", route: "/platform/integrations", roles: ["admin"], order: 20 }
    ]
  }
];
