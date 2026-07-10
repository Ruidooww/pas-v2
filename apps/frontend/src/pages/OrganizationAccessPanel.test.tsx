import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrganizationCatalog, OrganizationUnit, ProjectGroup } from "../types";
import { OrganizationAccessPanel } from "./OrganizationAccessPanel";

const units: OrganizationUnit[] = [
  createUnit("org-company", "Company", "company"),
  createUnit("org-sales", "Sales Department", "department", "org-company"),
  createUnit("org-technical", "Technical Department", "department", "org-company"),
  createUnit("org-technical-presales", "Presales Team", "team", "org-technical")
];

const projectGroups: ProjectGroup[] = [createProjectGroup("project-alpha", "Project Alpha")];

describe("OrganizationAccessPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("loads organization data and lets admins rename, disable, and create records", async () => {
    const fetchMock = vi.fn(mockOrganizationFetch);
    const onCatalogChange = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<OrganizationAccessPanel onCatalogChange={onCatalogChange} />);

    expect(await screen.findByText("Presales Team")).toBeTruthy();
    expect(screen.getByText("Project Alpha")).toBeTruthy();
    await waitFor(() =>
      expect(onCatalogChange).toHaveBeenCalledWith({ units, projectGroups } satisfies OrganizationCatalog)
    );

    fireEvent.change(screen.getByLabelText("Presales Team 名称"), { target: { value: "Solutions Team" } });
    fireEvent.click(screen.getByRole("button", { name: "Presales Team 保存名称" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/internal/organization/units/org-technical-presales",
        expect.objectContaining({ method: "PATCH" })
      );
    });
    expect(await screen.findByDisplayValue("Solutions Team")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Solutions Team 启用" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([path, init]) => path === "/api/internal/organization/units/org-technical-presales" && init?.method === "PATCH" && String(init.body).includes('"active":false')
      );
      expect(call).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("新项目组名称"), { target: { value: "Project Beta" } });
    fireEvent.click(screen.getByRole("button", { name: "创建项目组" }));
    expect(await screen.findByDisplayValue("Project Beta")).toBeTruthy();
  });

  it("keeps loaded organization data visible when a mutation fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (init?.method === "PATCH") return errorResponse(500, "write failed");
      return mockOrganizationFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<OrganizationAccessPanel onCatalogChange={vi.fn()} />);

    expect(await screen.findByText("Sales Department")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Presales Team 名称"), { target: { value: "Attempted Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Presales Team 保存名称" }));

    expect(await screen.findByText("服务暂时不可用，请稍后再试")).toBeTruthy();
    expect(screen.getByText("Sales Department")).toBeTruthy();
  });
});

function mockOrganizationFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  if (path === "/api/internal/organization/units" && (!init?.method || init.method === "GET")) {
    return Promise.resolve(jsonResponse(units));
  }
  if (path === "/api/internal/organization/project-groups" && (!init?.method || init.method === "GET")) {
    return Promise.resolve(jsonResponse(projectGroups));
  }
  if (path === "/api/internal/organization/units/org-technical-presales" && init?.method === "PATCH") {
    const body = JSON.parse(String(init.body)) as Partial<OrganizationUnit>;
    return Promise.resolve(jsonResponse({ ...units[3], ...body }));
  }
  if (path === "/api/internal/organization/project-groups" && init?.method === "POST") {
    const body = JSON.parse(String(init.body)) as { name: string };
    return Promise.resolve(jsonResponse(createProjectGroup("project-beta", body.name)));
  }
  return Promise.resolve(jsonResponse({}));
}

function createUnit(
  unitId: string,
  name: string,
  kind: OrganizationUnit["kind"],
  parentUnitId?: string
): OrganizationUnit {
  return {
    unitId,
    name,
    kind,
    parentUnitId,
    active: true,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  };
}

function createProjectGroup(projectGroupId: string, name: string): ProjectGroup {
  return {
    projectGroupId,
    name,
    active: true,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  };
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

function errorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({ message })
  } as Response;
}
