import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeDocument } from "../types";
import { KnowledgeDocumentsPage } from "./KnowledgeDocumentsPage";

const users = [
  {
    userId: "sales-1",
    username: "sales@example.com",
    displayName: "Sales One",
    role: "sales",
    organizationUnitId: "org-sales",
    projectGroupIds: ["project-alpha"],
    active: true
  }
];

const units = [
  {
    unitId: "org-company",
    name: "Company",
    kind: "company",
    active: true,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  },
  {
    unitId: "org-technical",
    name: "Technical Department",
    kind: "department",
    parentUnitId: "org-company",
    active: true,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  }
];

const projectGroups = [
  {
    projectGroupId: "project-alpha",
    name: "Project Alpha",
    active: true,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  }
];

describe("KnowledgeDocumentsPage", () => {
  beforeEach(() => {
    localStorage.setItem("pas.access-token", "test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("loads knowledge documents and shows readable visibility metadata", async () => {
    const fetchMock = vi.fn(createKnowledgeFetch([createDocument()]));
    vi.stubGlobal("fetch", fetchMock);

    render(<KnowledgeDocumentsPage />);

    expect(await screen.findByText("IP-Guard Manual")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("42 chunks")).toBeInTheDocument();
    expect(screen.getByText("7 hits")).toBeInTheDocument();
    expect(screen.getByText("1 bad feedback")).toBeInTheDocument();
    expect(screen.getByText("全员可见")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/internal/knowledge-documents",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" })
      })
    );
  });

  it.each([
    ["public", "全员可见", null, { scope: "public" }],
    ["roles", "角色", "technical", { scope: "roles", roles: ["technical"] }],
    ["users", "指定用户", "Sales One", { scope: "users", userIds: ["sales-1"] }],
    [
      "organization_units",
      "组织单元",
      null,
      { scope: "organization_units", organizationUnitIds: ["org-technical"] }
    ],
    [
      "project_groups",
      "项目组",
      "Project Alpha",
      { scope: "project_groups", projectGroupIds: ["project-alpha"] }
    ]
  ])("submits %s visibility targets", async (_scope, scopeLabel, targetLabel, expectedVisibility) => {
    const fetchMock = vi.fn(createKnowledgeFetch([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<KnowledgeDocumentsPage />);

    await screen.findByLabelText("文档 ID");
    if (scopeLabel !== "组织单元") await chooseOption("可见范围", scopeLabel);
    if (targetLabel) await chooseOption("可见目标", targetLabel);
    fillDocumentForm();
    fireEvent.click(screen.getByRole("button", { name: "登记文档" }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([path, init]) => path === "/api/internal/knowledge-documents" && init?.method === "POST"
      );
      expect(request).toBeTruthy();
      expect(JSON.parse(String(request?.[1]?.body))).toEqual(
        expect.objectContaining({ visibility: expectedVisibility })
      );
    });
  });

  it("disables submission when a targeted scope has no targets", async () => {
    vi.stubGlobal("fetch", vi.fn(createKnowledgeFetch([])));
    render(<KnowledgeDocumentsPage />);

    await screen.findByLabelText("文档 ID");
    await chooseOption("可见范围", "角色");
    fillDocumentForm();

    expect(screen.getByRole("button", { name: "登记文档" })).toBeDisabled();
  });

  it("hydrates edit state and displays project names instead of raw ids", async () => {
    const document = createDocument({
      documentId: "doc-project",
      title: "Project document",
      visibility: { scope: "project_groups", projectGroupIds: ["project-alpha"] }
    });
    const fetchMock = vi.fn(createKnowledgeFetch([document]));
    vi.stubGlobal("fetch", fetchMock);
    render(<KnowledgeDocumentsPage />);

    expect(await screen.findByText("Project Alpha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑 Project document" }));

    expect(screen.getByLabelText("文档 ID")).toHaveValue("doc-project");
    expect(screen.getByLabelText("文档标题")).toHaveValue("Project document");
    expect(screen.getByLabelText("可见范围").closest(".ant-select")).toHaveTextContent("项目组");
    expect(screen.getByLabelText("可见目标").closest(".ant-select")).toHaveTextContent("Project Alpha");
    expect(screen.getByRole("button", { name: "保存文档" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "保存文档" }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(
        ([path, init]) => path === "/api/internal/knowledge-documents" && init?.method === "POST"
      );
      expect(JSON.parse(String(request?.[1]?.body))).toEqual(
        expect.objectContaining({
          parseStatus: "done",
          chunkCount: 42,
          hitCount: 7,
          badFeedbackCount: 1,
          visibility: { scope: "project_groups", projectGroupIds: ["project-alpha"] }
        })
      );
    });
  });

  it("keeps loaded documents visible when an upsert fails", async () => {
    vi.stubGlobal("fetch", vi.fn(createKnowledgeFetch([createDocument()], true)));
    render(<KnowledgeDocumentsPage />);

    expect(await screen.findByText("IP-Guard Manual")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑 IP-Guard Manual" }));
    fireEvent.click(screen.getByRole("button", { name: "保存文档" }));

    expect(await screen.findByText("服务暂时不可用，请稍后再试")).toBeInTheDocument();
    expect(screen.getAllByText("IP-Guard Manual").length).toBeGreaterThan(0);
  });

  it("explains why the document list is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(createKnowledgeFetch([])));
    render(<KnowledgeDocumentsPage />);

    expect(await screen.findByText("暂无文档元数据")).toBeInTheDocument();
    expect(screen.getByText("当前仅登记 PAS 侧索引；真实资料仍在 RAGFlow 控制台维护。")).toBeInTheDocument();
  });
});

async function chooseOption(label: string, optionText: string): Promise<void> {
  fireEvent.mouseDown(screen.getByLabelText(label));
  await waitFor(() => expect(screen.getAllByRole("option").some((option) => option.textContent === optionText)).toBe(true));
  fireEvent.click(screen.getAllByRole("option").find((option) => option.textContent === optionText)!);
}

function fillDocumentForm(): void {
  fireEvent.change(screen.getByLabelText("文档 ID"), { target: { value: "doc-new" } });
  fireEvent.change(screen.getByLabelText("文档标题"), { target: { value: "New document" } });
  fireEvent.change(screen.getByLabelText("源文件名"), { target: { value: "new.pdf" } });
}

function createKnowledgeFetch(documents: KnowledgeDocument[], failWrite = false) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = String(input);
    if (path.startsWith("/api/internal/knowledge-documents") && (!init?.method || init.method === "GET")) {
      return jsonResponse(documents);
    }
    if (path === "/api/internal/auth/users") return jsonResponse(users);
    if (path === "/api/internal/organization/units") return jsonResponse(units);
    if (path === "/api/internal/organization/project-groups") return jsonResponse(projectGroups);
    if (path === "/api/internal/knowledge-documents" && init?.method === "POST") {
      if (failWrite) return errorResponse(500);
      const body = JSON.parse(String(init.body));
      return jsonResponse(createDocument(body));
    }
    return jsonResponse({});
  };
}

function createDocument(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    documentId: "doc-1",
    title: "IP-Guard Manual",
    product: "IP-Guard",
    materialType: "pdf",
    sourceName: "manual.pdf",
    parseStatus: "done",
    enabled: true,
    chunkCount: 42,
    hitCount: 7,
    badFeedbackCount: 1,
    tags: ["IP-Guard", "manual"],
    visibility: { scope: "public" },
    ownerUserId: "admin-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    ...overrides
  };
}

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: async () => ({ message: "write failed" }) } as Response;
}
