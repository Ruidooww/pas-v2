import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { fallbackMenuFor } from "./navigation";
import type { MenuConfiguration, PlatformOverview, PublicUser, WorkbenchOverview } from "./types";

const adminUser: PublicUser = {
  userId: "admin-1",
  username: "admin",
  displayName: "Admin",
  role: "admin",
  active: true
};

const salesUser: PublicUser = {
  userId: "sales-1",
  username: "sales",
  displayName: "Sales",
  role: "sales",
  active: true
};

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("shows the login page when no token is stored", async () => {
    localStorage.clear();
    render(<App />);

    expect(await screen.findByRole("heading", { name: /PAS/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /登\s*录/ })).toBeTruthy();
  });

  it("renders fixed first-level menus with left secondary navigation on desktop", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    expect((await screen.findAllByText("工作台")).length).toBeGreaterThan(0);
    expect(screen.getByText("客户作战")).toBeTruthy();
    expect(screen.getByText("方案生产")).toBeTruthy();
    expect(screen.getByText("运营分析")).toBeTruthy();
    expect(document.querySelector(".pas-secondary-strip")).toBeNull();
    fireEvent.click(screen.getByText("系统设置"));
    expect((await screen.findAllByText("账号权限")).length).toBeGreaterThan(0);
    expect(await screen.findByText("菜单配置")).toBeTruthy();
    expect(await screen.findByText("账号列表")).toBeTruthy();
  });

  it("shows the business flow console from the business first-level menu", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("客户作战"));
    fireEvent.click(await screen.findByText("商机推进"));

    expect(await screen.findByRole("heading", { name: "商机推进" })).toBeTruthy();
    expect(screen.getByText("业务记录")).toBeTruthy();
    expect(screen.queryByText("会议")).toBeNull();
    expect(screen.queryByText("合同")).toBeNull();
  });

  it("shows only analytics metrics from the analytics first-level menu", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("运营分析"));

    expect(await screen.findByRole("heading", { name: "运营分析" })).toBeTruthy();
    expect(await screen.findByText("运营指标")).toBeTruthy();
    expect(screen.queryByText("Agent / Skill 编排")).toBeNull();
    expect(screen.queryByText("多渠道入口")).toBeNull();
  });

  it("keeps platform governance tools under system settings", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("系统设置"));
    fireEvent.click(await screen.findByText("平台接入"));

    expect(await screen.findByRole("heading", { name: "平台接入" })).toBeTruthy();
    fireEvent.click(screen.getByText("Agent / Skill 编排"));
    expect(await screen.findByText("导入 Skill")).toBeTruthy();
  });

  it("falls back to default menu when effective menu fetch fails", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetchWithMenuFailure));

    render(<App />);

    expect((await screen.findAllByText("工作台")).length).toBeGreaterThan(0);
    expect(screen.getByText("客户作战")).toBeTruthy();
  });

  it("routes secondary menu configuration to the admin page", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("系统设置"));
    fireEvent.click(await screen.findByText("菜单配置"));

    expect(await screen.findByRole("heading", { name: "菜单配置" })).toBeTruthy();
  });

  it("hides management menus from sales users", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockSalesFetch));

    render(<App />);

    expect((await screen.findAllByRole("heading", { name: "总览看板" })).length).toBeGreaterThan(0);
    expect(screen.queryByText("运营分析")).toBeNull();
    expect(screen.queryByText("系统设置")).toBeNull();
    expect(screen.queryByText("文档运营")).toBeNull();
  });
});

function mockAdminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return mockFetchForUser(adminUser, input, init);
}

function mockSalesFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return mockFetchForUser(salesUser, input, init);
}

function mockAdminFetchWithMenuFailure(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  if (path === "/api/internal/menu/effective") {
    return Promise.resolve({
      ok: false,
      status: 500,
      json: async () => ({ message: "menu unavailable" })
    } as Response);
  }
  return mockAdminFetch(input, init);
}

function mockFetchForUser(user: PublicUser, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  if (path === "/api/me") {
    return Promise.resolve(jsonResponse(user));
  }
  if (path === "/api/internal/menu/effective") {
    return Promise.resolve(jsonResponse(fallbackMenuFor(user)));
  }
  if (path === "/api/internal/menu/configuration") {
    return Promise.resolve(jsonResponse(createMenuConfiguration()));
  }
  if (path === "/api/internal/menu/configuration/customers/reset") {
    return Promise.resolve(jsonResponse(createMenuConfiguration()));
  }
  if (path === "/api/internal/auth/users") {
    return Promise.resolve(jsonResponse([adminUser]));
  }
  if (path === "/api/internal/audit/events") {
    return Promise.resolve(jsonResponse([]));
  }
  if (path === "/api/internal/system/overview") {
    return Promise.resolve(jsonResponse(createSystemOverview()));
  }
  if (path === "/api/internal/workbench/overview") {
    return Promise.resolve(jsonResponse(createWorkbenchOverview()));
  }
  if (path.startsWith("/api/internal/workbench/tasks")) {
    return Promise.resolve(jsonResponse({ scope: "mine", tasks: createWorkbenchOverview().tasks }));
  }
  if (path === "/api/crm/customers") {
    return Promise.resolve(jsonResponse({ customers: [] }));
  }
  if (path === "/api/internal/proposals/library") {
    return Promise.resolve(jsonResponse([]));
  }
  if (path === "/api/internal/feedback") {
    return Promise.resolve(jsonResponse([]));
  }
  if (path === "/api/internal/business-flows/records") {
    return Promise.resolve(jsonResponse({ records: [] }));
  }
  if (path === "/api/internal/business-flows/metrics") {
    return Promise.resolve(jsonResponse({ definitions: [], counters: [] }));
  }
  if (path === "/api/internal/platform/overview") {
    return Promise.resolve(jsonResponse(createPlatformOverview()));
  }
  if (path === "/api/internal/menu/configuration" && init?.method === "PATCH") {
    return Promise.resolve(jsonResponse(createMenuConfiguration()));
  }
  return Promise.resolve(jsonResponse({}));
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function createMenuConfiguration(): MenuConfiguration {
  return {
    defaults: [
      {
        key: "workbench",
        label: "工作台",
        icon: "home",
        order: 10,
        children: [
          { key: "overview", label: "总览看板", route: "/workbench/overview", roles: ["sales", "presales", "admin"], order: 10 }
        ]
      },
      {
        key: "customers",
        label: "客户作战",
        icon: "customer",
        order: 20,
        children: [
          { key: "customer_management", label: "客户管理", route: "/customers", roles: ["sales", "presales", "admin"], order: 10 }
        ]
      },
      {
        key: "analytics_ops",
        label: "运营分析",
        icon: "analytics",
        order: 50,
        children: [
          { key: "analytics", label: "运营总览", route: "/platform/analytics", roles: ["admin"], order: 10 }
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
          { key: "system_settings", label: "运行配置", route: "/system/settings", roles: ["admin"], order: 50 }
        ]
      }
    ],
    overrides: []
  };
}

function createSystemOverview() {
  return {
    generatedAt: "2026-07-06T00:00:00.000Z",
    settings: [],
    paths: []
  };
}

function createWorkbenchOverview(): WorkbenchOverview {
  return {
    generatedAt: "2026-07-07T00:00:00.000Z",
    metrics: [
      { key: "active_tasks", label: "待处理任务", value: 2, hint: "mock" },
      { key: "high_priority", label: "高优先级", value: 1, hint: "mock" }
    ],
    tasks: [
      {
        taskId: "task-1",
        title: "方案初稿",
        customerName: "华信精工",
        owner: "Admin",
        status: "in_progress",
        priority: "high",
        dueAt: "2026-07-08",
        source: "proposal"
      }
    ],
    activities: [
      {
        activityId: "activity-1",
        title: "任务创建",
        description: "mock activity",
        happenedAt: "2026-07-07T00:00:00.000Z"
      }
    ]
  };
}

function createPlatformOverview(): PlatformOverview {
  return {
    dashboard: {
      filters: {},
      cards: [
        { key: "sales_funnel", title: "销售漏斗", value: 2, unit: "条" },
        { key: "pending_inputs", title: "待外部输入", value: 1, unit: "项" }
      ],
      drilldowns: {
        salesFunnel: [{ stage: "proposal", count: 1 }],
        channelContribution: [{ channel: "华东金牌渠道", count: 1 }],
        productMix: [{ product: "IP-Guard", count: 1 }],
        knowledgeUsage: [{ metric: "knowledge.records_created", value: 3 }],
        proposalConversion: [{ metric: "proposal_jobs_from_meetings", value: 1 }]
      },
      methodology: [{ key: "sales_funnel", description: "Count opportunities" }]
    },
    channels: [
      {
        channelId: "web",
        kind: "web",
        name: "PAS Web",
        status: "active",
        identityMapping: "pas_user",
        pendingInputs: []
      }
    ],
    recentSessions: [],
    agents: [
      {
        agentId: "agent-1",
        name: "售前编排 Agent",
        status: "active",
        purpose: "编排",
        allowedScopes: [],
        ownerRole: "presales"
      }
    ],
    skills: [
      {
        skillId: "skill-1",
        name: "知识库检索",
        status: "approved",
        requestedScopes: [],
        scan: { riskLevel: "low", findings: [] }
      }
    ],
    workflows: [
      {
        workflowId: "workflow-1",
        name: "客户信号触达工作流",
        status: "active",
        trigger: "cip",
        complexity: "controlled",
        agentIds: [],
        skillIds: []
      }
    ],
    products: [
      {
        productId: "ip-guard",
        name: "IP-Guard",
        status: "enabled",
        version: "v4",
        ownerTeam: "产品线",
        pendingInputs: []
      }
    ],
    cipSignals: [],
    tenant: {
      tenantId: "internal-hyyn",
      organizationId: "hyyn",
      mode: "single_org",
      isolationFields: ["tenantId"],
      billingReserved: true,
      singleOrgCompatible: true
    },
    security: {
      totalEvents: 1,
      eventsByType: { agent_execution: 1 },
      sensitiveAlerts: [],
      permissionBoundaryChecks: [{ key: "agent_skill_approval", status: "passed", summary: "ok" }]
    },
    trialReadiness: [{ area: "Agent/Skill", status: "code_ready", note: "ready" }],
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}
