import type { PrimaryMenuDefinition } from "./menu.types";

export const DEFAULT_PRIMARY_MENUS: PrimaryMenuDefinition[] = [
  {
    key: "workbench",
    label: "工作台",
    icon: "home",
    order: 10,
    children: [
      { key: "overview", label: "总览看板", route: "/workbench/overview", roles: ["sales", "technical", "admin"], order: 10 },
      { key: "my_tasks", label: "我的待办", route: "/workbench/my-tasks", roles: ["sales", "technical", "admin"], order: 20 },
      { key: "team_tasks", label: "团队任务", route: "/workbench/team-tasks", roles: ["technical", "admin"], order: 30 }
    ]
  },
  {
    key: "customers",
    label: "客户作战",
    icon: "customer",
    order: 20,
    children: [
      { key: "customer_management", label: "客户管理", route: "/customers", roles: ["sales", "technical", "admin"], order: 10 },
      { key: "customer_insights", label: "客户画像", route: "/customers/insights", roles: ["sales", "technical", "admin"], order: 20 },
      { key: "opportunities", label: "商机推进", route: "/business/opportunities", roles: ["sales", "technical", "admin"], order: 30 },
      { key: "meeting_minutes", label: "会议纪要", route: "/business/meetings", roles: ["sales", "technical", "admin"], order: 40 },
      { key: "contracts_after_sales", label: "合同售后", route: "/business/contracts-after-sales", roles: ["technical", "admin"], order: 50 }
    ]
  },
  {
    key: "knowledge_delivery",
    label: "方案生产",
    icon: "knowledge",
    order: 30,
    children: [
      { key: "proposal_tasks", label: "方案生成", route: "/proposals/tasks", roles: ["technical", "admin"], order: 10 },
      { key: "qa", label: "知识问答", route: "/knowledge/qa", roles: ["sales", "technical", "admin"], order: 20 },
      { key: "export_jobs", label: "导出中心", route: "/delivery/exports", roles: ["technical", "admin"], order: 30 },
      { key: "proposal_library", label: "方案库", route: "/proposals/library", roles: ["technical", "admin"], order: 40 }
    ]
  },
  {
    key: "business_loop",
    label: "知识与模板",
    icon: "business",
    order: 40,
    children: [
      { key: "documents", label: "文档运营", route: "/knowledge/documents", roles: ["technical", "admin"], order: 10 },
      { key: "knowledge_blocks", label: "知识块审核", route: "/knowledge/blocks", roles: ["technical", "admin"], order: 20 },
      { key: "templates", label: "模板运营", route: "/delivery/templates", roles: ["technical", "admin"], order: 30 },
      { key: "customer_feedback", label: "反馈闭环", route: "/business/feedback", roles: ["sales", "technical", "admin"], order: 40 }
    ]
  },
  {
    key: "analytics_ops",
    label: "运营分析",
    icon: "analytics",
    order: 50,
    children: [
      { key: "analytics", label: "运营总览", route: "/platform/analytics", roles: ["technical", "admin"], order: 10 }
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
      { key: "ai_model_access", label: "AI 模型接入", route: "/system/ai-models", roles: ["admin"], order: 60 },
      { key: "platform_governance", label: "平台接入", route: "/platform/governance", roles: ["admin"], order: 70 }
    ]
  }
];
