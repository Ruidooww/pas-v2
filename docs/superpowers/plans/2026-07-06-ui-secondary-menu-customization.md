# UI Secondary Menu Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement fixed first-level PAS navigation with configurable second-level menu visibility, ordering, aliases, role visibility, and default child routing.

**Architecture:** Add a small backend `MenuModule` with a code-owned default registry and snapshot-backed second-level override store. Refactor the frontend shell so fixed first-level menus render as collapsible groups and effective second-level menus come from `/api/internal/menu/effective`, with admin-only configuration at `系统管理 > 二级菜单配置`.

**Tech Stack:** NestJS 11, Prisma snapshot persistence, Vitest, React 19, Ant Design 6, TypeScript 6.

---

## Files

- Create: `apps/backend/src/menu/menu.types.ts`
- Create: `apps/backend/src/menu/menu-defaults.ts`
- Create: `apps/backend/src/menu/menu-store.service.ts`
- Create: `apps/backend/src/menu/menu.service.ts`
- Create: `apps/backend/src/menu/menu.controller.ts`
- Create: `apps/backend/src/menu/menu.module.ts`
- Create: `apps/backend/src/menu/menu.tokens.ts`
- Create: `apps/backend/src/menu/menu.service.spec.ts`
- Create: `apps/backend/src/menu/menu.controller.spec.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/audit/audit.types.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260706000000_menu_state_snapshot/migration.sql`
- Modify: `apps/frontend/src/types.ts`
- Modify: `apps/frontend/src/App.tsx`
- Create: `apps/frontend/src/navigation.tsx`
- Create: `apps/frontend/src/pages/MenuConfigPage.tsx`
- Modify: `apps/frontend/src/App.test.tsx`
- Create: `apps/frontend/src/pages/MenuConfigPage.test.tsx`
- Modify: `apps/frontend/src/styles.css`

## Task 1: Backend Menu Domain And Defaults

**Files:**

- Create: `apps/backend/src/menu/menu.types.ts`
- Create: `apps/backend/src/menu/menu-defaults.ts`
- Create: `apps/backend/src/menu/menu-store.service.ts`
- Create: `apps/backend/src/menu/menu.service.ts`
- Create: `apps/backend/src/menu/menu.service.spec.ts`

- [x] **Step 1: Add backend menu types**

Create `apps/backend/src/menu/menu.types.ts` with these exported types:

```ts
import type { UserRole } from "../auth/auth.types";

export type PrimaryMenuKey =
  | "workbench"
  | "customers"
  | "knowledge_delivery"
  | "business_loop"
  | "platform_ops"
  | "system";

export type SecondaryMenuKey =
  | "overview"
  | "my_tasks"
  | "team_tasks"
  | "customer_management"
  | "customer_insights"
  | "proposal_tasks"
  | "proposal_library"
  | "qa"
  | "documents"
  | "knowledge_blocks"
  | "templates"
  | "export_jobs"
  | "opportunities"
  | "meeting_minutes"
  | "contracts_after_sales"
  | "customer_feedback"
  | "platform_governance"
  | "product_registry"
  | "integration_health"
  | "analytics"
  | "account_management"
  | "audit_logs"
  | "data_attachments"
  | "secondary_menu_config"
  | "system_settings";

export type SecondaryMenuDefinition = {
  key: SecondaryMenuKey;
  label: string;
  route: string;
  roles: UserRole[];
  order: number;
};

export type PrimaryMenuDefinition = {
  key: PrimaryMenuKey;
  label: string;
  icon: string;
  order: number;
  children: SecondaryMenuDefinition[];
};

export type SecondaryMenuOverride = {
  primaryKey: PrimaryMenuKey;
  secondaryKey: SecondaryMenuKey;
  visible: boolean;
  order: number;
  alias?: string;
  roles: UserRole[];
  isDefault?: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type EffectiveSecondaryMenuItem = SecondaryMenuDefinition & {
  visible: true;
  label: string;
  isDefault: boolean;
};

export type EffectivePrimaryMenuItem = Omit<PrimaryMenuDefinition, "children"> & {
  children: EffectiveSecondaryMenuItem[];
  defaultSecondaryKey: SecondaryMenuKey;
};

export type MenuState = {
  stateId: "pas-menu-state";
  overrides: SecondaryMenuOverride[];
  updatedAt: string;
};

export type UpdateSecondaryMenuOverrideRequest = {
  primaryKey: PrimaryMenuKey;
  secondaryKey: SecondaryMenuKey;
  visible?: boolean;
  order?: number;
  alias?: string;
  roles?: UserRole[];
  isDefault?: boolean;
};
```

- [x] **Step 2: Add code-owned defaults**

Create `apps/backend/src/menu/menu-defaults.ts`. The default registry must include six first-level menus and their second-level children from the approved spec. Use stable route strings:

```ts
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
```

- [x] **Step 3: Add store service**

Create `apps/backend/src/menu/menu-store.service.ts` with `seed`, `getState`, `update`, and `resetPrimary` methods. It mirrors state through `sink.mirrorMenuState`.

```ts
import type { PersistenceSink } from "../persistence/persistence-sink";
import type { MenuState, PrimaryMenuKey } from "./menu.types";

type MenuPersistenceSink = Pick<PersistenceSink, "mirrorMenuState">;

export class MenuStoreService {
  private state?: MenuState;

  constructor(private readonly sink?: MenuPersistenceSink) {}

  seed(state: MenuState | undefined): void {
    if (!state || this.state) return;
    this.state = cloneState(state);
  }

  getState(): MenuState {
    if (!this.state) {
      this.state = { stateId: "pas-menu-state", overrides: [], updatedAt: new Date().toISOString() };
    }
    return cloneState(this.state);
  }

  update(mutator: (draft: MenuState) => void): MenuState {
    const draft = this.getState();
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    this.state = cloneState(draft);
    this.sink?.mirrorMenuState(this.state);
    return cloneState(this.state);
  }

  resetPrimary(primaryKey: PrimaryMenuKey): MenuState {
    return this.update((draft) => {
      draft.overrides = draft.overrides.filter((override) => override.primaryKey !== primaryKey);
    });
  }
}

function cloneState(state: MenuState): MenuState {
  return JSON.parse(JSON.stringify(state)) as MenuState;
}
```

- [x] **Step 4: Add service with validation and effective menu generation**

Create `apps/backend/src/menu/menu.service.ts`. The service must:

- Reject non-admin updates.
- Validate `primaryKey` and `secondaryKey` against `DEFAULT_PRIMARY_MENUS`.
- Apply overrides only to second-level items.
- If one child is set as default, unset `isDefault` for siblings in the same primary menu.
- Filter effective menus by actor role.

Use helpers named `assertAdmin`, `findPrimary`, `findSecondary`, `mergeChild`, and `sortByOrder`.

- [x] **Step 5: Add failing service tests**

Create `apps/backend/src/menu/menu.service.spec.ts` with tests for:

```ts
it("returns role-filtered effective menus for sales users", () => {
  const service = createService();

  const menu = service.getEffectiveMenu(salesUser);

  expect(menu.some((item) => item.key === "system")).toBe(false);
  expect(menu.find((item) => item.key === "customers")?.children.map((item) => item.key)).toEqual([
    "customer_management",
    "customer_insights"
  ]);
});

it("allows admin to hide and alias a second-level menu item", () => {
  const service = createService();

  service.updateOverride(
    {
      primaryKey: "customers",
      secondaryKey: "customer_insights",
      visible: false,
      alias: "客户分析",
      roles: ["presales", "admin"],
      order: 20
    },
    adminUser
  );

  const adminMenu = service.getEffectiveMenu(adminUser);
  const customerChildren = adminMenu.find((item) => item.key === "customers")?.children ?? [];
  expect(customerChildren.some((item) => item.key === "customer_insights")).toBe(false);
});

it("keeps first-level menus fixed when overrides are applied", () => {
  const service = createService();

  service.updateOverride({ primaryKey: "customers", secondaryKey: "proposal_library", visible: false }, adminUser);

  expect(service.getConfiguration(adminUser).defaults.map((item) => item.key)).toEqual([
    "workbench",
    "customers",
    "knowledge_delivery",
    "business_loop",
    "platform_ops",
    "system"
  ]);
});

it("rejects non-admin updates", () => {
  const service = createService();

  expect(() =>
    service.updateOverride({ primaryKey: "customers", secondaryKey: "proposal_library", visible: false }, salesUser)
  ).toThrow(ForbiddenException);
});

it("rejects unknown second-level keys", () => {
  const service = createService();

  expect(() =>
    service.updateOverride(
      { primaryKey: "customers", secondaryKey: "qa" as never, visible: false },
      adminUser
    )
  ).toThrow(BadRequestException);
});

it("resets one first-level menu to defaults", () => {
  const service = createService();
  service.updateOverride({ primaryKey: "customers", secondaryKey: "proposal_library", visible: false }, adminUser);

  service.resetPrimary("customers", adminUser);

  const customerChildren = service.getEffectiveMenu(adminUser).find((item) => item.key === "customers")?.children ?? [];
  expect(customerChildren.some((item) => item.key === "proposal_library")).toBe(true);
});
```

Run: `pnpm --filter pas-backend test -- src/menu/menu.service.spec.ts`

Expected before implementation is complete: failing tests that reference missing menu files. Expected after implementation: the six tests pass.

## Task 2: Backend Controller, Module, Persistence, And Audit

**Files:**

- Create: `apps/backend/src/menu/menu.controller.ts`
- Create: `apps/backend/src/menu/menu.module.ts`
- Create: `apps/backend/src/menu/menu.tokens.ts`
- Create: `apps/backend/src/menu/menu.controller.spec.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/audit/audit.types.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260706000000_menu_state_snapshot/migration.sql`

- [x] **Step 1: Add persistence schema**

Append this Prisma model to `apps/backend/prisma/schema.prisma`:

```prisma
model MenuStateSnapshot {
  snapshotId String   @id @map("snapshot_id")
  data       Json
  updatedAt  DateTime @map("updated_at")

  @@index([updatedAt])
  @@map("menu_state_snapshots")
}
```

Create `apps/backend/prisma/migrations/20260706000000_menu_state_snapshot/migration.sql`:

```sql
CREATE TABLE "menu_state_snapshots" (
  "snapshot_id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "menu_state_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

CREATE INDEX "menu_state_snapshots_updated_at_idx" ON "menu_state_snapshots"("updated_at");
```

- [x] **Step 2: Extend `PersistenceSink`**

In `apps/backend/src/persistence/persistence-sink.ts`, import `MenuState` and add methods:

```ts
mirrorMenuState(state: MenuState): void {
  if (!this.client) return;
  const data = {
    data: state as unknown as object,
    updatedAt: new Date(state.updatedAt)
  };
  this.client.menuStateSnapshot
    .upsert({
      where: { snapshotId: state.stateId },
      create: { snapshotId: state.stateId, ...data },
      update: data
    })
    .catch((error) => this.logMirrorFailure("menu_state", state.stateId, error));
}

async loadMenuState(): Promise<MenuState | undefined> {
  if (!this.client) return undefined;
  const row = await this.client.menuStateSnapshot.findFirst({ orderBy: { updatedAt: "desc" } });
  return row ? (row.data as unknown as MenuState) : undefined;
}
```

- [x] **Step 3: Extend audit action union**

In `apps/backend/src/audit/audit.types.ts`, add `"menu_configuration"` to `AuditAction`.

- [x] **Step 4: Add controller**

Create `apps/backend/src/menu/menu.controller.ts`:

```ts
import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MENU_SERVICE } from "./menu.tokens";
import type { MenuService } from "./menu.service";
import type { PrimaryMenuKey, UpdateSecondaryMenuOverrideRequest } from "./menu.types";

type RequestWithUser = { user: AuthenticatedUser };

@Controller("api/internal/menu")
export class MenuController {
  constructor(@Inject(MENU_SERVICE) private readonly service: MenuService) {}

  @Get("effective")
  getEffectiveMenu(@Req() request: RequestWithUser) {
    return this.service.getEffectiveMenu(request.user);
  }

  @Get("configuration")
  getConfiguration(@Req() request: RequestWithUser) {
    return this.service.getConfiguration(request.user);
  }

  @Patch("configuration")
  updateOverride(@Req() request: RequestWithUser, @Body() body: UpdateSecondaryMenuOverrideRequest) {
    return this.service.updateOverride(body, request.user);
  }

  @Post("configuration/:primaryKey/reset")
  resetPrimary(@Req() request: RequestWithUser, @Param("primaryKey") primaryKey: PrimaryMenuKey) {
    return this.service.resetPrimary(primaryKey, request.user);
  }
}
```

- [x] **Step 5: Add module and wire `AppModule`**

Create `apps/backend/src/menu/menu.tokens.ts`:

```ts
export const MENU_STORE = Symbol("MENU_STORE");
export const MENU_SERVICE = Symbol("MENU_SERVICE");
```

Create `apps/backend/src/menu/menu.module.ts`, following `PlatformModule`: inject `PERSISTENCE_SINK`, `AUDIT_LOG`, hydrate from `sink.loadMenuState()`, and export `MENU_SERVICE`.

Modify `apps/backend/src/app.module.ts` to import `MenuModule`.

- [x] **Step 6: Add controller tests**

Create `apps/backend/src/menu/menu.controller.spec.ts` with tests that verify:

```ts
it("delegates effective and configuration reads with the authenticated user", () => {
  const service = {
    getEffectiveMenu: vi.fn().mockReturnValue([]),
    getConfiguration: vi.fn().mockReturnValue({ defaults: [], overrides: [] })
  } as unknown as MenuService;
  const controller = new MenuController(service);

  expect(controller.getEffectiveMenu(request)).toEqual([]);
  expect(controller.getConfiguration(request)).toEqual({ defaults: [], overrides: [] });
  expect(service.getEffectiveMenu).toHaveBeenCalledWith(request.user);
  expect(service.getConfiguration).toHaveBeenCalledWith(request.user);
});

it("delegates override updates with the authenticated user", () => {
  const service = {
    updateOverride: vi.fn().mockReturnValue({ overrides: [] })
  } as unknown as MenuService;
  const controller = new MenuController(service);
  const body = { primaryKey: "customers", secondaryKey: "proposal_library", visible: false } as const;

  expect(controller.updateOverride(request, body)).toEqual({ overrides: [] });
  expect(service.updateOverride).toHaveBeenCalledWith(body, request.user);
});

it("delegates primary reset with the authenticated user", () => {
  const service = {
    resetPrimary: vi.fn().mockReturnValue({ overrides: [] })
  } as unknown as MenuService;
  const controller = new MenuController(service);

  expect(controller.resetPrimary(request, "customers")).toEqual({ overrides: [] });
  expect(service.resetPrimary).toHaveBeenCalledWith("customers", request.user);
});
```

Run: `pnpm --filter pas-backend test -- src/menu`

Expected: menu service and controller tests pass.

## Task 3: Frontend Navigation Registry And Effective Menu Fetch

**Files:**

- Modify: `apps/frontend/src/types.ts`
- Create: `apps/frontend/src/navigation.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/App.test.tsx`

- [x] **Step 1: Add frontend menu types**

Append to `apps/frontend/src/types.ts`:

```ts
export type PrimaryMenuKey = "workbench" | "customers" | "knowledge_delivery" | "business_loop" | "platform_ops" | "system";
export type SecondaryMenuKey =
  | "overview"
  | "my_tasks"
  | "team_tasks"
  | "customer_management"
  | "customer_insights"
  | "proposal_tasks"
  | "proposal_library"
  | "qa"
  | "documents"
  | "knowledge_blocks"
  | "templates"
  | "export_jobs"
  | "opportunities"
  | "meeting_minutes"
  | "contracts_after_sales"
  | "customer_feedback"
  | "platform_governance"
  | "product_registry"
  | "integration_health"
  | "analytics"
  | "account_management"
  | "audit_logs"
  | "data_attachments"
  | "secondary_menu_config"
  | "system_settings";

export type EffectiveSecondaryMenuItem = {
  key: SecondaryMenuKey;
  label: string;
  route: string;
  roles: PublicUser["role"][];
  order: number;
  visible: true;
  isDefault: boolean;
};

export type EffectivePrimaryMenuItem = {
  key: PrimaryMenuKey;
  label: string;
  icon: string;
  order: number;
  children: EffectiveSecondaryMenuItem[];
  defaultSecondaryKey: SecondaryMenuKey;
};
```

- [x] **Step 2: Add frontend navigation helpers**

Create `apps/frontend/src/navigation.tsx` with:

- `fallbackMenuFor(user: PublicUser): EffectivePrimaryMenuItem[]`
- `routeToView(route: string): View`
- `viewToTitle(view: View): string`
- `menuIcon(icon: string): ReactNode`
- `buildAntMenuItems(menu: EffectivePrimaryMenuItem[])`

The fallback menu must match backend defaults for visible items by role.

- [x] **Step 3: Refactor `App.tsx`**

Change `View` to include:

```ts
type View =
  | "workbench"
  | "qa"
  | "business"
  | "platform"
  | "knowledge"
  | "documents"
  | "templates"
  | "menuConfig";
```

After login, fetch `/api/internal/menu/effective`. If it fails, use `fallbackMenuFor(user)`.

Render `Menu` with nested first-level items and set `selectedKeys` to the active secondary key. A first-level item click routes to its `defaultSecondaryKey`.

Map these routes to existing pages:

- `/workbench/*`, `/customers/*`, `/proposals/*` -> `WorkbenchPage`
- `/knowledge/qa` -> `QaPage`
- `/knowledge/documents` -> `KnowledgeDocumentsPage`
- `/knowledge/blocks` -> `KnowledgeBlocksPage`
- `/delivery/templates`, `/delivery/exports` -> `ExportTemplatesPage`
- `/business/*` -> `BusinessFlowsPage`
- `/platform/*` -> `PlatformPage`
- `/system/secondary-menu` -> `MenuConfigPage`

- [x] **Step 4: Update App tests**

Update `apps/frontend/src/App.test.tsx` fetch stubs to handle `/api/internal/menu/effective`.

Add tests:

```ts
it("renders fixed first-level menus with second-level children", async () => {
  localStorage.setItem("pas.access-token", "token");
  vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

  render(<App />);

  expect(await screen.findByText("工作台")).toBeTruthy();
  expect(screen.getByText("客户与方案")).toBeTruthy();
  expect(screen.getByText("知识与交付")).toBeTruthy();
  expect(screen.getByText("系统管理")).toBeTruthy();
  fireEvent.click(screen.getByText("系统管理"));
  expect(await screen.findByText("二级菜单配置")).toBeTruthy();
});

it("falls back to default menu when effective menu fetch fails", async () => {
  localStorage.setItem("pas.access-token", "token");
  vi.stubGlobal("fetch", vi.fn(mockAdminFetchWithMenuFailure));

  render(<App />);

  expect(await screen.findByText("工作台")).toBeTruthy();
  expect(screen.getByText("客户与方案")).toBeTruthy();
});

it("routes secondary menu configuration to the admin page", async () => {
  localStorage.setItem("pas.access-token", "token");
  vi.stubGlobal("fetch", vi.fn(mockAdminFetch));

  render(<App />);

  fireEvent.click(await screen.findByText("系统管理"));
  fireEvent.click(await screen.findByText("二级菜单配置"));

  expect(await screen.findByRole("heading", { name: "二级菜单配置" })).toBeTruthy();
});
```

Run: `pnpm --filter pas-frontend test -- src/App.test.tsx`

Expected: App tests pass.

## Task 4: Frontend Secondary Menu Configuration Page

**Files:**

- Create: `apps/frontend/src/pages/MenuConfigPage.tsx`
- Create: `apps/frontend/src/pages/MenuConfigPage.test.tsx`
- Modify: `apps/frontend/src/styles.css`

- [x] **Step 1: Add `MenuConfigPage`**

Create an admin-facing page with:

- Left `List` of fixed first-level menus.
- Center `Table` of second-level children for selected first-level menu.
- Right side notes explaining fixed first-level menus and backend authorization.
- Controls for visibility switch, alias input, role tags, default child button, reset button, and save button.

The page reads `/api/internal/menu/configuration`, updates via `PATCH /api/internal/menu/configuration`, and resets via `POST /api/internal/menu/configuration/:primaryKey/reset`.

- [x] **Step 2: Add page tests**

Create `apps/frontend/src/pages/MenuConfigPage.test.tsx` with tests:

```ts
it("lists fixed first-level menus and selected secondary items", async () => {
  vi.stubGlobal("fetch", vi.fn(mockMenuConfigFetch));

  render(<MenuConfigPage />);

  expect(await screen.findByText("客户与方案")).toBeTruthy();
  expect(screen.getByText("客户管理")).toBeTruthy();
  expect(screen.getByText("方案任务")).toBeTruthy();
});

it("sends a visibility update for a second-level item", async () => {
  const fetchMock = vi.fn(mockMenuConfigFetch);
  vi.stubGlobal("fetch", fetchMock);

  render(<MenuConfigPage />);
  fireEvent.click(await screen.findByRole("switch", { name: "方案任务" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/internal/menu/configuration",
    expect.objectContaining({ method: "PATCH" })
  );
});

it("sends a reset request for the selected first-level menu", async () => {
  const fetchMock = vi.fn(mockMenuConfigFetch);
  vi.stubGlobal("fetch", fetchMock);

  render(<MenuConfigPage />);
  fireEvent.click(await screen.findByRole("button", { name: "恢复本组默认" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/internal/menu/configuration/customers/reset",
    expect.objectContaining({ method: "POST" })
  );
});
```

Run: `pnpm --filter pas-frontend test -- src/pages/MenuConfigPage.test.tsx`

Expected: tests pass.

- [x] **Step 3: Add CSS**

Add scoped classes to `apps/frontend/src/styles.css`:

- `.pas-shell`
- `.pas-sidebar`
- `.pas-menu`
- `.pas-content`
- `.menu-config-page`
- `.menu-config-layout`
- `.menu-config-primary`
- `.menu-config-table`
- `.menu-config-rail`

Keep existing page classes intact. Do not restyle unrelated pages beyond shell/navigation.

## Task 5: Full Verification And Commit

**Files:**

- Modify plan checkboxes in `docs/superpowers/plans/2026-07-06-ui-secondary-menu-customization.md` as tasks are completed.

- [x] **Step 1: Run backend verification**

Run:

```powershell
pnpm --filter pas-backend test
pnpm --filter pas-backend typecheck
```

Expected:

- Backend tests pass.
- TypeScript typecheck passes.

- [x] **Step 2: Run frontend verification**

Run:

```powershell
pnpm --filter pas-frontend test
pnpm --filter pas-frontend typecheck
```

Expected:

- Frontend tests pass.
- TypeScript typecheck passes.

- [x] **Step 3: Run repo-level checks**

Run:

```powershell
pnpm typecheck
pnpm test
```

Expected:

- Recursive typecheck passes.
- Recursive tests pass.

- [x] **Step 4: Review final diff**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected:

- Only planned files changed.
- `git diff --check` has no output.
- Diff is focused on menu configuration and navigation.

- [x] **Step 5: Commit**

Run:

```powershell
git add apps/backend/src/menu apps/backend/src/app.module.ts apps/backend/src/audit/audit.types.ts apps/backend/src/persistence/persistence-sink.ts apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/20260706000000_menu_state_snapshot/migration.sql apps/frontend/src docs/superpowers/plans/2026-07-06-ui-secondary-menu-customization.md
git commit -m "feat: add configurable secondary navigation"
```

Expected: one commit on `codex/ui-navigation-secondary-menu`.
