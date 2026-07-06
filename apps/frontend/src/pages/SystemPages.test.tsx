import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getAllByText("configured").length).toBeGreaterThan(0);
    expect(screen.queryByText("ragflow-secret")).toBeNull();
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
    ]
  };
}
