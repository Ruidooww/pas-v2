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

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/auth/users/admin-1",
      expect.objectContaining({ method: "PATCH" })
    );
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
    return Promise.resolve(jsonResponse({ ...adminUser, active: false }));
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
