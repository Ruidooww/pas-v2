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
  organizationUnitId: "org-company",
  projectGroupIds: [],
  active: true
};

const salesUser: PublicUser = {
  userId: "sales-1",
  username: "sales",
  displayName: "Sales",
  role: "sales",
  organizationUnitId: "org-sales",
  projectGroupIds: [],
  active: true
};

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("shows the login page when no token is stored", async () => {
    localStorage.clear();
    render(<App />);

    expect((await screen.findAllByRole("heading", { name: /PAS/ })).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /登\s*录/ })).toBeTruthy();
  });

  it("loads an existing cookie session without a stored bearer token", async () => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    expect((await screen.findAllByText("Admin")).length).toBeGreaterThan(0);
  });

  it("loads configured login branding before authentication", async () => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(mockBrandingFetch));

    render(<App />);

    expect(await screen.findByAltText("HYYN 售前工作台 logo")).toHaveAttribute(
      "src",
      "https://example.com/hyyn-logo.png"
    );
    expect(screen.getAllByText("HYYN 售前工作台").length).toBeGreaterThan(0);
  });

  it("does not emit deprecated Ant Design List warnings on initial dashboard render", async () => {
    localStorage.setItem("pas.access-token", "token");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    expect((await screen.findAllByText("方案初稿")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/星云科技解决方案/)).toBeNull();
    const messages = consoleError.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(messages).not.toContain("[antd: List]");
  });

  it("renders fixed first-level menus with left secondary navigation on desktop", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    expect((await screen.findAllByText("方案初稿")).length).toBeGreaterThan(0);
    expect(screen.getByText("待处理任务")).toBeTruthy();
    expect(screen.getAllByText("阻塞").length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Admin")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("工作台")).length).toBeGreaterThan(0);
    expect(screen.getByText("客户作战")).toBeTruthy();
    expect(screen.getByText("方案生产")).toBeTruthy();
    expect(screen.getByText("运营分析")).toBeTruthy();
    expect(document.querySelector(".pas-secondary-strip")).toBeNull();
    expect(screen.getByText("我的待办")).toBeTruthy();
    expect(screen.queryByText("账号权限")).toBeNull();
    fireEvent.click(screen.getByText("系统设置"));
    const accountMenuItems = await screen.findAllByText("账号权限");
    expect(accountMenuItems.length).toBeGreaterThan(0);
    expect(await screen.findByText("菜单配置")).toBeTruthy();
    expect(document.querySelector('[data-menu-id$="primary:workbench"]')?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[data-menu-id$="primary:system"]')?.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(accountMenuItems[0] as HTMLElement);
    expect(await screen.findByText("账号列表")).toBeTruthy();
  });

  it("collapses and expands the sidebar from the bottom control", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    const collapseButton = await screen.findByRole("button", { name: "收起侧边栏" });
    fireEvent.click(collapseButton);

    expect(document.querySelector(".pas-sidebar")?.className).toContain("ant-layout-sider-collapsed");
    fireEvent.click(await screen.findByRole("button", { name: "展开侧边栏" }));
    expect(document.querySelector(".pas-sidebar")?.className).not.toContain("ant-layout-sider-collapsed");
  });

  it("routes notification items from the topbar bell", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "通知" }));

    expect(screen.queryByText("待我评审：2 条方案需要处理")).toBeNull();
    expect(screen.queryByText("方案交付：1 个任务今日到期")).toBeNull();
    expect(screen.queryByText("知识库：1 条内容更新待确认")).toBeNull();

    fireEvent.click(await screen.findByText("待我评审"));

    expect((await screen.findAllByRole("heading", { name: "我的待办" })).length).toBeGreaterThan(0);
  });

  it("shows the business flow console from the business first-level menu", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("客户作战"));
    const opportunityMenuItem = (await screen.findAllByText("商机推进")).find((element) =>
      element.closest('[role="menuitem"]')
    );
    expect(opportunityMenuItem).toBeTruthy();
    fireEvent.click(opportunityMenuItem as HTMLElement);

    expect(await screen.findByRole("heading", { name: "商机推进" })).toBeTruthy();
    expect(await screen.findByText("业务记录")).toBeTruthy();
    expect(screen.queryByText("会议")).toBeNull();
    expect(screen.queryByText("合同")).toBeNull();
  });

  it("shows only analytics metrics from the analytics first-level menu", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("运营分析"));
    const analyticsMenuItem = (await screen.findAllByText("运营总览")).find((element) =>
      element.closest('[role="menuitem"]')
    );
    expect(analyticsMenuItem).toBeTruthy();
    fireEvent.click(analyticsMenuItem as HTMLElement);

    expect(await screen.findByRole("heading", { name: "运营分析" }, { timeout: 5_000 })).toBeTruthy();
    expect(await screen.findByText("运营指标")).toBeTruthy();
    expect(screen.queryByText("Agent / Skill 编排")).toBeNull();
    expect(screen.queryByText("多渠道入口")).toBeNull();
  });

  it("routes export jobs to the export center page instead of template operations", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("方案生产"));
    fireEvent.click(await screen.findByText("导出中心"));

    expect((await screen.findAllByRole("heading", { name: "导出中心" })).length).toBeGreaterThan(0);
    expect(await screen.findByText("导出任务")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "模板运营" })).toBeNull();
  });

  it("shows existing proposal jobs from the proposal generation page", async () => {
    localStorage.setItem("pas.access-token", "token");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    fireEvent.click(await screen.findByText("方案生产"));
    const proposalMenuItem = (await screen.findAllByText("方案生成")).find((element) =>
      element.closest('[role="menuitem"]')
    );
    expect(proposalMenuItem).toBeTruthy();
    fireEvent.click(proposalMenuItem as HTMLElement);

    expect((await screen.findAllByRole("heading", { name: "方案生成" })).length).toBeGreaterThan(0);
    expect(await screen.findByText("最近方案任务")).toBeTruthy();
    expect(await screen.findByText("demo-huaxin-manufacturing")).toBeTruthy();
    expect(await screen.findByText("proposal-job-1")).toBeTruthy();
  });

  it("opens the secondary page that matches the current browser path", async () => {
    localStorage.setItem("pas.access-token", "token");
    window.history.pushState({}, "", "/proposals/tasks");
    vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

    render(<App />);

    expect((await screen.findAllByRole("heading", { name: "方案生成" })).length).toBeGreaterThan(0);
    expect(await screen.findByText("最近方案任务")).toBeTruthy();
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

function mockBrandingFetch(input: RequestInfo | URL): Promise<Response> {
  const path = String(input);
  if (path === "/api/me") {
    return Promise.resolve(errorResponse(401, { message: "bearer token is required" }));
  }
  if (path === "/api/branding/login") {
    return Promise.resolve(
      jsonResponse({
        title: "HYYN 售前工作台",
        subtitle: "统一售前入口",
        logoUrl: "https://example.com/hyyn-logo.png"
      })
    );
  }
  return Promise.resolve(jsonResponse({}));
}

function mockFetchForUser(user: PublicUser, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  if (path === "/api/me") {
    return Promise.resolve(jsonResponse(user));
  }
  if (path === "/api/branding/login") {
    return Promise.resolve(jsonResponse(createLoginBranding()));
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
  if (path === "/api/internal/proposals") {
    return Promise.resolve(jsonResponse(createProposalJobs()));
  }
  if (path === "/api/internal/exports") {
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

function errorResponse(status: number, payload: unknown): Response {
  return {
    ok: false,
    status,
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
          { key: "overview", label: "总览看板", route: "/workbench/overview", roles: ["sales", "technical", "admin"], order: 10 }
        ]
      },
      {
        key: "customers",
        label: "客户作战",
        icon: "customer",
        order: 20,
        children: [
          { key: "customer_management", label: "客户管理", route: "/customers", roles: ["sales", "technical", "admin"], order: 10 }
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
    paths: [],
    branding: createLoginBranding()
  };
}

function createLoginBranding() {
  return {
    title: "PAS 售前辅助系统",
    subtitle: "账号由管理员分配，如无账号请联系管理员"
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
      },
      {
        taskId: "task-2",
        title: "模板复核阻塞项",
        customerName: "岚云软件",
        owner: "Admin",
        status: "blocked",
        priority: "medium",
        dueAt: "2026-07-10",
        source: "manual"
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

function createProposalJobs() {
  return [
    {
      jobId: "proposal-job-1",
      status: "completed",
      request: {
        customerId: "demo-huaxin-manufacturing",
        userId: "admin-1"
      },
      progress: [
        {
          step: "export_package_ready",
          status: "completed",
          message: "Export package is ready",
          at: "2026-07-07T00:00:00.000Z"
        }
      ],
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z"
    }
  ];
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
        ownerRole: "technical"
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
