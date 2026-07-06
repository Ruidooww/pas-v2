# UI Navigation And Secondary Menu Design

## Goal

Define the PAS UI direction before implementation: use a polished Apple Business visual style, an enterprise collapsible sidebar, fixed first-level navigation, and configurable second-level navigation.

This design captures the approved direction from the visual review at `http://localhost:53594`.

## Visual Direction

The main UI should feel like a mature internal enterprise application, not a marketing page or a decorative dashboard.

Use:

- Light gray app background with white work surfaces.
- Thin dividers, restrained shadows, and compact 7-8px radius controls.
- Apple-like typography and spacing discipline.
- Blue as the primary action color, with restrained green/amber/red status tags.
- Dense workbench layout for operational screens: metrics, filters, tables, queues, and side panels.

Avoid:

- Large decorative cards for page sections.
- Heavy gradients, oversized hero areas, or purely visual filler.
- One-screen-only mockup behavior that cannot scale to V1-V3 modules.

## Navigation Model

PAS uses a collapsible enterprise sidebar.

First-level menus are fixed by product version and are not user-editable:

- `工作台`
- `客户与方案`
- `知识与交付`
- `业务闭环`
- `平台运营`
- `系统管理`

Only the active first-level menu should expand by default. Other first-level menus show their label and expand arrow. This keeps the sidebar short while preserving the enterprise navigation pattern.

## Default Second-Level Menus

`工作台`:

- `总览看板`
- `我的待办`
- `团队任务`

`客户与方案`:

- `客户管理`
- `客户画像`
- `方案任务`
- `方案库`

`知识与交付`:

- `知识库问答`
- `文档运营`
- `知识块审核`
- `模板库`
- `导出任务`

`业务闭环`:

- `商机管理`
- `会议纪要`
- `合同售后`
- `客户反馈`

`平台运营`:

- `平台治理`
- `产品注册`
- `集成健康`
- `统计分析`

`系统管理`:

- `账号管理`
- `日志中心`
- `数据与附件`
- `二级菜单配置`
- `系统设置`

## Secondary Menu Customization

Customization applies only to second-level menus. First-level menus stay locked.

Admins can configure second-level menus per first-level menu:

- Show or hide a second-level item.
- Reorder visible second-level items.
- Set a display alias.
- Set role visibility, such as `售前`, `主管`, or `管理员`.
- Set the default landing child for a first-level menu.

Admins cannot:

- Rename, hide, or reorder first-level menus.
- Create a route that does not exist in the application.
- Point a second-level item at an arbitrary external URL.
- Bypass backend authorization by changing menu visibility.

Menu customization is a presentation and navigation layer. Backend permission checks remain authoritative.

## System Management UX

`系统管理 > 二级菜单配置` is the configuration page.

The page has three columns:

- Left: fixed first-level menu selector.
- Center: editable second-level menu table for the selected first-level menu.
- Right: role preview and implementation notes.

The editable table includes:

- Drag handle for ordering.
- Second-level menu name and optional alias.
- Visibility toggle.
- Role visibility selector.
- Default child action.

`系统管理 > 系统设置` remains the broader settings area for RAGFlow, CRM, LLM, template, export, and deployment configuration. It is separate from secondary menu configuration.

## Data Shape

The implementation should store second-level menu overrides with a simple structure:

```ts
type SecondaryMenuOverride = {
  primaryKey: string;
  secondaryKey: string;
  visible: boolean;
  order: number;
  alias?: string;
  roles: string[];
  isDefault?: boolean;
};
```

The system default menu registry remains code-owned. Overrides are applied on top of defaults at runtime.

## Frontend Behavior

The frontend should:

- Render first-level menus from the fixed registry.
- Fetch secondary-menu overrides after login.
- Merge defaults and overrides before rendering second-level items.
- Hide unavailable second-level items by role and visibility.
- Expand the current first-level menu by route match.
- Route a first-level click to its configured default child.

If override loading fails, the sidebar falls back to default menus and shows no blocking error.

## Backend Behavior

The backend should expose authenticated internal endpoints for admin configuration:

- Read the effective menu for the current user.
- Read all menu configuration for admins.
- Update second-level menu overrides.
- Reset one first-level menu to defaults.

Only admin users can mutate menu configuration. All updates are audited.

## Persistence

Use existing persistence patterns. If the current implementation still relies on snapshot-backed in-memory services, menu overrides can follow that pattern first.

The persisted state should be small and deterministic:

- Product default registry lives in frontend/backend code.
- Persisted records only store deviations from defaults.
- Reset removes overrides for the selected first-level menu.

## Testing

Backend tests:

- Non-admin users cannot update menu configuration.
- Admin updates only affect second-level menus.
- Unknown `primaryKey` or `secondaryKey` is rejected.
- Role filtering produces the expected effective menu.
- Reset returns the selected first-level menu to defaults.

Frontend tests:

- Sidebar renders fixed first-level menus.
- Active first-level menu expands by route.
- Hidden second-level items do not render.
- Aliases render without changing route keys.
- First-level click uses configured default child.
- Failed menu-config fetch falls back to defaults.

Visual checks:

- Sidebar text does not overflow at desktop width.
- Expanded second-level menus remain usable without pushing system management off-screen.
- Dense table views retain readable row height and status tags.

## Rollback

The rollback path is straightforward:

- Ignore persisted menu overrides.
- Render default second-level menus from the fixed registry.
- Keep all backend authorization unchanged.

No data migration should be required for rollback because overrides are additive presentation configuration.
