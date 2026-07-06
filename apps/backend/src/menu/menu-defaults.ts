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
    label: "客户与方案",
    icon: "customer",
    order: 20,
    children: [
      { key: "customer_management", label: "客户管理", route: "/customers", roles: ["sales", "presales", "admin"], order: 10 },
      { key: "customer_insights", label: "客户画像", route: "/customers/insights", roles: ["sales", "presales", "admin"], order: 20 },
      { key: "proposal_tasks", label: "方案任务", route: "/proposals/tasks", roles: ["presales", "admin"], order: 30 },
      { key: "proposal_library", label: "方案库", route: "/proposals/library", roles: ["presales", "admin"], order: 40 }
    ]
  },
  {
    key: "knowledge_delivery",
    label: "知识与交付",
    icon: "knowledge",
    order: 30,
    children: [
      { key: "qa", label: "知识库问答", route: "/knowledge/qa", roles: ["sales", "presales", "admin"], order: 10 },
      { key: "documents", label: "文档运营", route: "/knowledge/documents", roles: ["presales", "admin"], order: 20 },
      { key: "knowledge_blocks", label: "知识块审核", route: "/knowledge/blocks", roles: ["presales", "admin"], order: 30 },
      { key: "templates", label: "模板库", route: "/delivery/templates", roles: ["presales", "admin"], order: 40 },
      { key: "export_jobs", label: "导出任务", route: "/delivery/exports", roles: ["presales", "admin"], order: 50 }
    ]
  },
  {
    key: "business_loop",
    label: "业务闭环",
    icon: "business",
    order: 40,
    children: [
      { key: "opportunities", label: "商机管理", route: "/business/opportunities", roles: ["sales", "presales", "admin"], order: 10 },
      { key: "meeting_minutes", label: "会议纪要", route: "/business/meetings", roles: ["sales", "presales", "admin"], order: 20 },
      { key: "contracts_after_sales", label: "合同售后", route: "/business/contracts-after-sales", roles: ["presales", "admin"], order: 30 },
      { key: "customer_feedback", label: "客户反馈", route: "/business/feedback", roles: ["sales", "presales", "admin"], order: 40 }
    ]
  },
  {
    key: "platform_ops",
    label: "平台运营",
    icon: "platform",
    order: 50,
    children: [
      { key: "platform_governance", label: "平台治理", route: "/platform/governance", roles: ["presales", "admin"], order: 10 },
      { key: "product_registry", label: "产品注册", route: "/platform/products", roles: ["admin"], order: 20 },
      { key: "integration_health", label: "集成健康", route: "/platform/integrations", roles: ["admin"], order: 30 },
      { key: "analytics", label: "统计分析", route: "/platform/analytics", roles: ["presales", "admin"], order: 40 }
    ]
  },
  {
    key: "system",
    label: "系统管理",
    icon: "system",
    order: 60,
    children: [
      { key: "account_management", label: "账号管理", route: "/system/accounts", roles: ["admin"], order: 10 },
      { key: "audit_logs", label: "日志中心", route: "/system/audit-logs", roles: ["admin"], order: 20 },
      { key: "data_attachments", label: "数据与附件", route: "/system/data-attachments", roles: ["admin"], order: 30 },
      { key: "secondary_menu_config", label: "二级菜单配置", route: "/system/secondary-menu", roles: ["admin"], order: 40 },
      { key: "system_settings", label: "系统设置", route: "/system/settings", roles: ["admin"], order: 50 }
    ]
  }
];
