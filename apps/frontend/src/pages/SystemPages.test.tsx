import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountsPage } from "./AccountsPage";
import { AuditLogsPage } from "./AuditLogsPage";
import { DataAttachmentsPage } from "./DataAttachmentsPage";
import { SystemSettingsPage } from "./SystemSettingsPage";
import type { AuditEvent, PublicUser, SystemOverview } from "../types";

const adminUser: PublicUser = {
  userId: "admin-1",
  username: "admin",
  displayName: "Admin",
  role: "admin",
  organizationUnitId: "org-company",
  projectGroupIds: [],
  active: true
};

describe("system pages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("loads accounts and sends active-state updates", async () => {
    const fetchMock = vi.fn(mockSystemFetch);
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountsPage />);

    expect(await screen.findByText("Admin")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "admin 启用" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/internal/auth/users/admin-1",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    await waitFor(() => expect(screen.getByRole("switch", { name: "admin 启用" })).not.toBeChecked());
  });

  it("keeps login credentials out of the new-account form", async () => {
    vi.stubGlobal("fetch", vi.fn(mockSystemFetch));

    render(<AccountsPage />);
    expect(await screen.findByText("Admin")).toBeTruthy();

    expect(screen.getByLabelText("账号")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("姓名")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("初始密码")).toHaveAttribute("autocomplete", "new-password");
  });

  it("uses current roles and restricts technical account membership to the technical subtree", async () => {
    const fetchMock = vi.fn(mockSystemFetch);
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountsPage />);
    expect(await screen.findByText("Admin")).toBeTruthy();

    fireEvent.mouseDown(screen.getByLabelText("新账号角色"));
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    const roleOptions = screen.getAllByRole("option");
    expect(roleOptions.map((option) => option.textContent)).toEqual(expect.arrayContaining(["sales", "technical", "admin"]));
    expect(roleOptions.some((option) => option.textContent === "presales")).toBe(false);
    fireEvent.click(roleOptions.find((option) => option.textContent === "technical")!);

    fireEvent.mouseDown(screen.getByLabelText("新账号组织单元"));
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    const unitOptions = screen.getAllByRole("option");
    expect(unitOptions.some((option) => option.textContent === "Presales Team")).toBe(true);
    expect(unitOptions.some((option) => option.textContent === "Technical Team")).toBe(true);
    expect(unitOptions.some((option) => option.textContent === "After-sales Team")).toBe(true);
    expect(unitOptions.some((option) => option.textContent === "Sales Department")).toBe(false);
    fireEvent.click(unitOptions.find((option) => option.textContent === "Presales Team")!);

    fireEvent.mouseDown(screen.getByLabelText("admin 项目组"));
    await waitFor(() => expect(screen.getAllByRole("option").some((option) => option.textContent === "Project Alpha")).toBe(true));
    fireEvent.click(screen.getAllByRole("option").find((option) => option.textContent === "Project Alpha")!);

    await waitFor(() => {
      const update = fetchMock.mock.calls.find(
        ([path, init]) => path === "/api/internal/auth/users/admin-1" && String(init?.body).includes('"projectGroupIds":["project-alpha"]')
      );
      expect(update).toBeTruthy();
    });
  });

  it("uses an active compatible unit when an account role changes", async () => {
    const organizationUnits = createOrganizationUnits().map((unit) =>
      unit.unitId === "org-technical-presales" ? { ...unit, active: false } : unit
    );
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/internal/organization/units") {
        return Promise.resolve(jsonResponse(organizationUnits));
      }
      return mockSystemFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountsPage />);
    expect(await screen.findByText("Admin")).toBeTruthy();

    fireEvent.mouseDown(screen.getByLabelText("admin 角色"));
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("option").find((option) => option.textContent === "technical")!);

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([path, init]) => path === "/api/internal/auth/users/admin-1" && init?.method === "PATCH"
      );
      expect(JSON.parse(String(request?.[1]?.body))).toEqual(
        expect.objectContaining({ role: "technical", organizationUnitId: "org-technical" })
      );
    });
  });

  it("keeps accounts visible when organization metadata fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).startsWith("/api/internal/organization/")) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ message: "organization unavailable" })
          } as Response);
        }
        return mockSystemFetch(input, init);
      })
    );

    render(<AccountsPage />);

    expect(await screen.findByText("Admin")).toBeTruthy();
    expect(await screen.findByText("服务暂时不可用，请稍后再试")).toBeTruthy();
    expect(screen.getByLabelText("admin 角色")).toBeTruthy();
  });

  it("loads audit events", async () => {
    vi.stubGlobal("fetch", vi.fn(mockSystemFetch));

    render(<AuditLogsPage />);

    expect(await screen.findByText("login")).toBeTruthy();
    expect(screen.getByText("auth_session / admin-1")).toBeTruthy();
  });

  it("loads data and attachment path status", async () => {
    vi.stubGlobal("fetch", vi.fn(mockSystemFetch));

    render(<DataAttachmentsPage />);

    expect(await screen.findByText("文件存储")).toBeTruthy();
    expect(screen.getByText("C:\\pas-files")).toBeTruthy();
    expect(screen.getByText("10 B")).toBeTruthy();
  });

  it("loads sanitized system settings", async () => {
    vi.stubGlobal("fetch", vi.fn(mockSystemFetch));

    render(<SystemSettingsPage />);

    expect(await screen.findByText("RAGFlow")).toBeTruthy();
    expect(screen.getByText("http://localhost:19380")).toBeTruthy();
    expect(screen.getByText("登录页品牌")).toBeTruthy();
    expect(screen.getAllByText("configured").length).toBeGreaterThan(0);
    expect(screen.queryByText("ragflow-secret")).toBeNull();
  });

  it("saves login branding settings", async () => {
    const fetchMock = vi.fn(mockSystemFetch);
    vi.stubGlobal("fetch", fetchMock);

    render(<SystemSettingsPage />);

    const titleInput = await screen.findByLabelText("登录页标题");
    await waitFor(() => expect(titleInput).toHaveValue("PAS 售前辅助系统"));
    fireEvent.change(titleInput, { target: { value: "HYYN 售前工作台" } });
    expect(titleInput).toHaveValue("HYYN 售前工作台");
    fireEvent.change(screen.getByLabelText("登录页说明"), { target: { value: "统一售前入口" } });
    fireEvent.change(screen.getByLabelText("Logo URL"), { target: { value: "/assets/logo.png" } });
    fireEvent.click(screen.getByRole("button", { name: "保存登录页品牌" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([path]) => path === "/api/internal/system/branding")).toBe(true);
    });
    const brandingCall = fetchMock.mock.calls.find(([path]) => path === "/api/internal/system/branding");
    expect(brandingCall?.[1]).toEqual(expect.objectContaining({ method: "PATCH" }));
    expect(JSON.parse(String(brandingCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        title: "HYYN 售前工作台"
      })
    );
    expect(await screen.findByText("HYYN 售前工作台")).toBeTruthy();
  });
});

function mockSystemFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  if (path === "/api/internal/auth/users" && (!init?.method || init.method === "GET")) {
    return Promise.resolve(jsonResponse([adminUser]));
  }
  if (path === "/api/internal/auth/users/admin-1" && init?.method === "PATCH") {
    return Promise.resolve(jsonResponse({ ...adminUser, ...JSON.parse(String(init.body)) }));
  }
  if (path === "/api/internal/organization/units") {
    return Promise.resolve(jsonResponse(createOrganizationUnits()));
  }
  if (path === "/api/internal/organization/project-groups") {
    return Promise.resolve(
      jsonResponse([
        {
          projectGroupId: "project-alpha",
          name: "Project Alpha",
          active: true,
          createdAt: "2026-07-10T00:00:00.000Z",
          updatedAt: "2026-07-10T00:00:00.000Z"
        }
      ])
    );
  }
  if (path === "/api/internal/audit/events") {
    return Promise.resolve(jsonResponse(createAuditEvents()));
  }
  if (path === "/api/internal/system/overview") {
    return Promise.resolve(jsonResponse(createSystemOverview()));
  }
  if (path === "/api/internal/system/branding" && init?.method === "PATCH") {
    const body = JSON.parse(String(init.body));
    return Promise.resolve(jsonResponse({ ...createSystemOverview().branding, ...body, updatedBy: "admin-1" }));
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

function createOrganizationUnits() {
  const now = "2026-07-10T00:00:00.000Z";
  return [
    { unitId: "org-company", name: "Company", kind: "company", active: true, createdAt: now, updatedAt: now },
    { unitId: "org-sales", name: "Sales Department", kind: "department", parentUnitId: "org-company", active: true, createdAt: now, updatedAt: now },
    { unitId: "org-technical", name: "Technical Department", kind: "department", parentUnitId: "org-company", active: true, createdAt: now, updatedAt: now },
    { unitId: "org-technical-presales", name: "Presales Team", kind: "team", parentUnitId: "org-technical", active: true, createdAt: now, updatedAt: now },
    { unitId: "org-technical-engineering", name: "Technical Team", kind: "team", parentUnitId: "org-technical", active: true, createdAt: now, updatedAt: now },
    { unitId: "org-technical-aftersales", name: "After-sales Team", kind: "team", parentUnitId: "org-technical", active: true, createdAt: now, updatedAt: now }
  ];
}

function createAuditEvents(): AuditEvent[] {
  return [
    {
      auditId: "audit-1",
      action: "login",
      actorUserId: "admin-1",
      objectType: "auth_session",
      objectId: "admin-1",
      result: "success",
      occurredAt: "2026-07-06T00:00:00.000Z"
    }
  ];
}

function createSystemOverview(): SystemOverview {
  return {
    generatedAt: "2026-07-06T00:00:00.000Z",
    settings: [
      {
        group: "ragflow",
        key: "RAGFLOW_BASE_URL",
        label: "RAGFlow 地址",
        value: "http://localhost:19380",
        status: "configured",
        secret: false
      },
      {
        group: "ragflow",
        key: "RAGFLOW_API_KEY",
        label: "RAGFlow API Key",
        value: "configured",
        status: "configured",
        secret: true
      }
    ],
    paths: [
      {
        label: "文件存储",
        path: "C:\\pas-files",
        exists: true,
        writable: true,
        fileCount: 2,
        totalBytes: 10,
        truncated: false
      }
    ],
    branding: {
      title: "PAS 售前辅助系统",
      subtitle: "账号由管理员分配，如无账号请联系管理员",
      logoUrl: "https://example.com/logo.png"
    }
  };
}
