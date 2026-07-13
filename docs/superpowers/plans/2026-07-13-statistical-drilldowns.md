# Statistical Drilldowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every PAS summary/statistic number an accessible drilldown that opens or focuses truthful detail records with the represented filter preserved.

**Architecture:** A shared native-button wrapper provides consistent metric interaction without changing page layout. URL helpers serialize supported drilldown filters; cross-page navigation remains owned by `App`, while each destination page owns filtering/grouping of data it already loads.

**Tech Stack:** React 19, TypeScript, Ant Design 6, Vitest, Testing Library, Vite.

## Global Constraints

- Do not add a router, state-management package, chart package, or backend API.
- Preserve existing menu authorization; hidden routes remain unreachable.
- Convert only summary/statistic blocks, not dates, IDs, pagination, table-cell values, form values, or record tags.
- Every interactive metric is a native `button` with a descriptive accessible name.
- Zero counts remain clickable and use the destination's existing empty state.
- Cross-page drilldowns preserve query parameters; invalid parameters are ignored.
- Existing visual dimensions and responsive layout must not shift.

---

## File Map

- Create `apps/frontend/src/components/MetricDrilldown.tsx`: shared accessible metric button wrapper.
- Create `apps/frontend/src/drilldown.ts`: query serialization, parsing, and same-page history helpers.
- Create `apps/frontend/src/drilldown.test.ts`: query helper tests.
- Modify `apps/frontend/src/App.tsx`: query-aware secondary-menu navigation and page callbacks.
- Modify `apps/frontend/src/App.test.tsx`: cross-page KPI navigation tests.
- Modify page files under `apps/frontend/src/pages/`: page-owned filters/groupings and metric wrappers.
- Modify existing page tests plus create `apps/frontend/src/pages/OperationalDrilldowns.test.tsx` for pages without dedicated tests.
- Modify `apps/frontend/src/styles.css`: stable hover/focus/pressed styles and filter-summary layout.
- Modify `scripts/smoke-local-menu.mjs`: keep destination routes covered; no new route is added.

### Task 1: Shared Drilldown Contract And Navigation

**Files:**
- Create: `apps/frontend/src/components/MetricDrilldown.tsx`
- Create: `apps/frontend/src/drilldown.ts`
- Create: `apps/frontend/src/drilldown.test.ts`
- Modify: `apps/frontend/src/App.tsx`
- Test: `apps/frontend/src/App.test.tsx`

**Interfaces:**
- Produces `MetricDrilldown({ label, className, onClick, children })`.
- Produces `buildDrilldownSearch(params): string` and `readDrilldown(search, schema): Record<string, string>`.
- Extends `navigateToSecondary(key, { updateUrl, search })` without bypassing menu lookup.

- [ ] **Step 1: Write failing helper and navigation tests**

```tsx
expect(buildDrilldownSearch({ priority: "high", empty: undefined })).toBe("?priority=high");
expect(readDrilldown("?status=unknown", { status: ["blocked", "done"] })).toEqual({});

fireEvent.click(await screen.findByRole("button", { name: "查看高优先级明细" }));
await screen.findByRole("heading", { name: "我的待办" });
expect(window.location.pathname).toBe("/workbench/my-tasks");
expect(window.location.search).toBe("?priority=high");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pas-frontend exec vitest run src/drilldown.test.ts src/App.test.tsx`

Expected: FAIL because the helper, button role, and query-aware navigation do not exist.

- [ ] **Step 3: Implement the shared contract**

```tsx
export function MetricDrilldown(props: {
  label: string;
  className?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={["metric-drilldown", props.className].filter(Boolean).join(" ")} aria-label={`查看${props.label}明细`} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
```

Implement query helpers with `URLSearchParams`, allowlisted values, and sorted keys. Extend `navigateToSecondary` so it resolves the authorized menu item before writing `${route}${search}`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter pas-frontend exec vitest run src/drilldown.test.ts src/App.test.tsx`

Expected: both files pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/frontend/src/components/MetricDrilldown.tsx apps/frontend/src/drilldown.ts apps/frontend/src/drilldown.test.ts apps/frontend/src/App.tsx apps/frontend/src/App.test.tsx
git commit -m "feat: add shared metric drilldown navigation"
```

### Task 2: Workbench And Customer Drilldowns

**Files:**
- Modify: `apps/frontend/src/pages/WorkbenchOverviewPage.tsx`
- Modify: `apps/frontend/src/pages/CustomerManagementPage.tsx`
- Modify: `apps/frontend/src/pages/WorkbenchPage.tsx`
- Test: `apps/frontend/src/App.test.tsx`
- Test: `apps/frontend/src/pages/CustomerManagementPage.test.tsx`

**Interfaces:**
- Workbench receives `onNavigate(key, search)` from `App`.
- Task query values are `priority=high` and `status=active|blocked|done`.
- Customer query values are `groupBy=industry|region` and optional `customerId`.

- [ ] **Step 1: Write failing workbench/customer tests**

```tsx
fireEvent.click(screen.getByRole("button", { name: "查看行业数明细" }));
expect(await screen.findByRole("heading", { name: "行业分布" })).toBeTruthy();
expect(window.location.search).toBe("?groupBy=industry");

fireEvent.click(screen.getByRole("button", { name: "查看外部阻塞明细" }));
expect(window.location.pathname).toBe("/workbench/team-tasks");
expect(window.location.search).toBe("?status=blocked");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pas-frontend exec vitest run src/App.test.tsx src/pages/CustomerManagementPage.test.tsx`

Expected: FAIL because metrics are noninteractive and no grouped customer detail exists.

- [ ] **Step 3: Implement mappings and destination filters**

Wrap all workbench KPI/review rows and customer summary metrics with `MetricDrilldown`. Filter task arrays from allowlisted query values before mapping. Render industry/region grouped counts above the customer table and keep the raw customer table available.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter pas-frontend exec vitest run src/App.test.tsx src/pages/CustomerManagementPage.test.tsx`

Expected: both files pass, including keyboard button roles and query assertions.

- [ ] **Step 5: Commit**

```powershell
git add apps/frontend/src/pages/WorkbenchOverviewPage.tsx apps/frontend/src/pages/CustomerManagementPage.tsx apps/frontend/src/pages/WorkbenchPage.tsx apps/frontend/src/App.test.tsx apps/frontend/src/pages/CustomerManagementPage.test.tsx
git commit -m "feat: drill into workbench and customer metrics"
```

### Task 3: Operational List Drilldowns

**Files:**
- Modify: `apps/frontend/src/pages/ExportJobsPage.tsx`
- Modify: `apps/frontend/src/pages/FeedbackPage.tsx`
- Modify: `apps/frontend/src/pages/ProposalLibraryPage.tsx`
- Modify: `apps/frontend/src/pages/BusinessFlowsPage.tsx`
- Test: `apps/frontend/src/pages/ExportJobsPage.test.tsx`
- Test: `apps/frontend/src/pages/ProposalLibraryPage.test.tsx`
- Create: `apps/frontend/src/pages/OperationalDrilldowns.test.tsx`

**Interfaces:**
- Export filter: `result=all|completed|abnormal`.
- Feedback filter: `feedback=all|open|negative`.
- Proposal filter: `source=all|generated`.
- Business filter: `records=all|pending_inputs|in_progress`.

- [ ] **Step 1: Write failing list-filter tests**

```tsx
fireEvent.click(await screen.findByRole("button", { name: "查看异常明细" }));
expect(screen.queryByText("completed-job")).toBeNull();
expect(screen.getByText("failed-job")).toBeTruthy();

fireEvent.click(await screen.findByRole("button", { name: "查看负反馈明细" }));
expect(screen.queryByText("rating-five-record")).toBeNull();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pas-frontend exec vitest run src/pages/ExportJobsPage.test.tsx src/pages/ProposalLibraryPage.test.tsx src/pages/OperationalDrilldowns.test.tsx`

Expected: FAIL because summary metrics do not filter their lists.

- [ ] **Step 3: Implement page-owned filters**

Add one allowlisted filter state per page, derive `visibleRecords`, wrap every summary statistic, update the query string, and render existing list/empty states from `visibleRecords`.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm --filter pas-frontend exec vitest run src/pages/ExportJobsPage.test.tsx src/pages/ProposalLibraryPage.test.tsx src/pages/OperationalDrilldowns.test.tsx`

```powershell
git add apps/frontend/src/pages/ExportJobsPage.tsx apps/frontend/src/pages/FeedbackPage.tsx apps/frontend/src/pages/ProposalLibraryPage.tsx apps/frontend/src/pages/BusinessFlowsPage.tsx apps/frontend/src/pages/ExportJobsPage.test.tsx apps/frontend/src/pages/ProposalLibraryPage.test.tsx apps/frontend/src/pages/OperationalDrilldowns.test.tsx
git commit -m "feat: filter operational records from summary metrics"
```

### Task 4: Administration Drilldowns

**Files:**
- Modify: `apps/frontend/src/pages/AccountsPage.tsx`
- Modify: `apps/frontend/src/pages/AuditLogsPage.tsx`
- Modify: `apps/frontend/src/pages/MenuConfigPage.tsx`
- Modify: `apps/frontend/src/pages/SystemSettingsPage.tsx`
- Test: `apps/frontend/src/pages/SystemPages.test.tsx`
- Test: `apps/frontend/src/pages/MenuConfigPage.test.tsx`

**Interfaces:**
- Account filter: `accounts=all|active|admin`.
- Audit filter uses existing `result=all|failure`; “current result” focuses the current result set.
- Menu filter: `menus=primary|visible|custom`.
- Settings filter: `settings=all|configured|missing`.

- [ ] **Step 1: Write failing admin metric tests**

```tsx
fireEvent.click(await screen.findByRole("button", { name: "查看管理员明细" }));
expect(screen.getByText("admin-user")).toBeTruthy();
expect(screen.queryByText("sales-user")).toBeNull();

fireEvent.click(await screen.findByRole("button", { name: "查看失败事件明细" }));
expect(screen.queryByText("success.action")).toBeNull();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pas-frontend exec vitest run src/pages/SystemPages.test.tsx src/pages/MenuConfigPage.test.tsx`

Expected: FAIL because hero statistics are plain `div` elements.

- [ ] **Step 3: Implement filters/focus and verify GREEN**

Filter existing users, audit events, menu rows, and setting groups; wrap all hero statistics; use existing empty/loading states.

Run: `pnpm --filter pas-frontend exec vitest run src/pages/SystemPages.test.tsx src/pages/MenuConfigPage.test.tsx`

- [ ] **Step 4: Commit**

```powershell
git add apps/frontend/src/pages/AccountsPage.tsx apps/frontend/src/pages/AuditLogsPage.tsx apps/frontend/src/pages/MenuConfigPage.tsx apps/frontend/src/pages/SystemSettingsPage.tsx apps/frontend/src/pages/SystemPages.test.tsx apps/frontend/src/pages/MenuConfigPage.test.tsx
git commit -m "feat: drill into administration statistics"
```

### Task 5: Data And Platform Drilldowns

**Files:**
- Modify: `apps/frontend/src/pages/DataAttachmentsPage.tsx`
- Modify: `apps/frontend/src/pages/PlatformPage.tsx`
- Test: `apps/frontend/src/pages/SystemPages.test.tsx`
- Test: `apps/frontend/src/pages/PlatformPage.test.tsx`

**Interfaces:**
- Path filter: `paths=all|with_files|missing`; per-path metrics focus `path=<label>`.
- Platform top metrics select `channels|skills|products|security`.
- Analytics cards select an allowlisted dashboard card key and render its existing drilldown array.

- [ ] **Step 1: Write failing data/platform tests**

```tsx
fireEvent.click(await screen.findByRole("button", { name: "查看缺失路径明细" }));
expect(screen.queryByText("existing-path")).toBeNull();

fireEvent.click(await screen.findByRole("button", { name: "查看销售漏斗明细" }));
expect(await screen.findByRole("heading", { name: "销售漏斗明细" })).toBeTruthy();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pas-frontend exec vitest run src/pages/SystemPages.test.tsx src/pages/PlatformPage.test.tsx`

Expected: FAIL because statistics have no actions or detail selection.

- [ ] **Step 3: Implement truthful drilldowns and verify GREEN**

Use existing path records and `overview.dashboard.drilldowns`; do not invent file rows or analytics values. For per-path size/count, focus the selected path card and its existing path description.

Run: `pnpm --filter pas-frontend exec vitest run src/pages/SystemPages.test.tsx src/pages/PlatformPage.test.tsx`

- [ ] **Step 4: Commit**

```powershell
git add apps/frontend/src/pages/DataAttachmentsPage.tsx apps/frontend/src/pages/PlatformPage.tsx apps/frontend/src/pages/SystemPages.test.tsx apps/frontend/src/pages/PlatformPage.test.tsx
git commit -m "feat: expose data and analytics drilldowns"
```

### Task 6: Styling, Coverage Audit, And Browser QA

**Files:**
- Modify: `apps/frontend/src/styles.css`
- Modify: `scripts/smoke-local-menu.mjs` only if a destination contract changed
- Test: all frontend tests

**Interfaces:**
- `.metric-drilldown` resets native button chrome and provides hover, focus-visible, and active states without changing dimensions.
- `.drilldown-filter-summary` and `.drilldown-group-panel` use existing spacing and Ant components.

- [ ] **Step 1: Add source coverage assertions**

Add a focused test that renders each summary surface and asserts all inventory labels use `role=button`; do not scan or convert record-row numbers.

- [ ] **Step 2: Implement responsive styles**

```css
.metric-drilldown {
  appearance: none;
  color: inherit;
  font: inherit;
  text-align: inherit;
  cursor: pointer;
}

.metric-drilldown:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}
```

Preserve existing border separators and stable grid tracks; add only background/border-color transitions.

- [ ] **Step 3: Run full repository gates**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm compose:config
pnpm test:smoke
```

Expected: all commands exit `0`.

- [ ] **Step 4: Rebuild and run live smoke**

```powershell
docker compose --env-file .env up -d --build pas-frontend pas-backend
pnpm smoke:local -- --base-url http://127.0.0.1:18000
```

Expected: 6 primary menus and 24 secondary menus pass.

- [ ] **Step 5: Browser QA**

At `1576x1216` and `390x844`, verify:

- KPI tiles and side review rows are full-surface buttons;
- high-priority and blocked drilldowns show filtered records;
- customer industry grouping is visible and clearable;
- an admin statistic filters its detail list;
- browser back returns to the originating page;
- no horizontal overflow, overlap, or layout shift occurs.

- [ ] **Step 6: Final commit and push**

```powershell
git add apps/frontend/src/styles.css scripts/smoke-local-menu.mjs
git commit -m "test: verify statistical drilldowns"
git push origin main
```
