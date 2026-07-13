# PAS Statistical Drilldowns Design

## Goal

Make every summary/statistic number in PAS actionable. Activating a statistic
must reveal the records represented by that number, preserve the drilldown in
the URL when practical, and work with mouse, keyboard, and touch.

## Scope

Included:

- numeric values rendered in dashboard KPI rows, hero statistic blocks, Ant
  Design `Statistic` blocks, and page-level summary metric grids;
- zero-valued statistics, which still open an empty filtered result;
- cross-page navigation, same-page filtering/grouping, and detail-panel focus;
- desktop and mobile hover/focus/pressed states and accessible button names.

Excluded:

- dates, timestamps, IDs, page numbers, form values, table-cell quantities,
  record tags, percentages or amounts embedded in prose;
- nonnumeric status/configuration values such as model name, provider source,
  `yes/no`, and enabled/disabled labels;
- new backend aggregate or detail APIs. Drilldowns use data already returned by
  the current page or an existing destination page.

## Interaction Contract

1. The complete statistic tile/row is a native button, not only the digits.
2. Cross-page drilldowns use the existing secondary-menu navigation function
   and append a query string such as `status=blocked` or `priority=high`.
3. Destination pages read supported query parameters on initial load and
   browser back/forward, apply the corresponding filter/grouping, and display a
   compact active-filter label with a clear action.
4. Same-page drilldowns update the local filter/grouping, synchronize the query
   string, and focus or scroll to the detail region.
5. A zero count remains actionable and shows the destination's existing empty
   state after filtering.
6. A role must never gain a route it cannot see. Team-task drilldowns fall back
   to the current user's task list when `team_tasks` is unavailable.
7. Unsupported or malformed query values are ignored and produce the normal
   unfiltered page.

## Shared Frontend Boundary

- `apps/frontend/src/components/MetricDrilldown.tsx` renders the shared native
  button wrapper for custom metric layouts and Ant Design statistics.
- `apps/frontend/src/drilldown.ts` owns query construction/parsing and the
  supported drilldown value types. It does not know page data.
- `App.tsx` extends secondary-menu navigation with an optional query string and
  passes a navigation callback to pages that need cross-page drilldowns.
- Each destination page owns its data filter because it already owns the
  corresponding records. No global data store is introduced.

## Page Mapping

| Surface | Statistic | Drilldown |
| --- | --- | --- |
| Workbench overview | Pending tasks | `my_tasks`, active tasks |
| Workbench overview | High priority | `my_tasks?priority=high` |
| Workbench overview | External blockers | `team_tasks?status=blocked`, role-safe fallback to `my_tasks` |
| Workbench overview | Customers | `customer_management` |
| Review and delivery | Proposal related | `proposal_tasks?source=proposal` |
| Review and delivery | Blocked / completed | task page with `status=blocked` or `status=done` |
| My/team tasks | Task KPI numbers | Same task list with status/priority filter |
| Customer management | Customer count | Customer list, unfiltered |
| Customer management | Industry / region count | Customer list plus grouped count panel for the selected dimension |
| Customer insights | Customer pool count | `customer_management` |
| Proposal workbench | Export progress count | `export_jobs` filtered by the current source package when available |
| Export center | All / completed / abnormal | Export list filtered by status group |
| Feedback | All / open / negative | Feedback list filtered by status or rating |
| Proposal library | All / generated | Proposal list filtered by source |
| Business flows | All / pending input / in progress | Business record list filtered by the represented condition |
| Accounts | All / active / admin | Account list filtered by activity or role |
| Audit logs | All / current result / failures | Audit list with the represented result filter |
| Menu configuration | Primary / visible / customized | Focus primary list or filter secondary rows |
| System settings | All / configured / pending | Settings groups filtered by status family |
| Data and attachments | Paths / files / missing paths | Path grid filtered by the represented condition |
| Data and attachments | Per-path file count / size | Focus the selected path detail card |
| Platform governance | Active channels / approved skills / enabled products | Open the corresponding tertiary section |
| Operations analytics | Dashboard cards | Show the existing matching `dashboard.drilldowns` collection |
| Platform security | Audit event count | Open audit logs for admin; otherwise focus the security detail list |

## Visual Behavior

- Existing layout, dimensions, typography, and palette remain unchanged.
- Actionable metrics gain a subtle border/background hover state, a visible
  `:focus-visible` outline, and a pressed state without shifting layout.
- The cursor is a pointer; the button keeps the surrounding tile's current
  square/compact shape.
- On mobile, the full row remains at least the existing row height and can be
  activated without targeting the number itself.
- Active filters use existing Ant Design `Tag` and `Button` components rather
  than explanatory instruction text.

## Error And Empty States

- Navigation to a missing or role-hidden secondary menu is a no-op and does not
  mutate the URL.
- Invalid query parameters are discarded.
- Filtered lists reuse their current empty-state component or empty text.
- No click triggers a new network mutation; drilldowns are read-only.

## Tests

- Unit-test query serialization/parsing and unsupported-value handling.
- App tests prove KPI clicks update the selected menu and URL query.
- Page tests prove statistic buttons filter/group the visible record set and
  clear correctly.
- Accessibility assertions require button roles and descriptive names.
- Existing smoke keeps every destination route backend-backed.
- Browser QA covers workbench, customer management, one operations list, and
  one admin page at desktop and mobile widths, including back navigation.

## Acceptance Criteria

- Every statistic number identified by the scope inventory has an actionable
  tile/row and a truthful destination or detail focus.
- Clicking high-priority, blocked, completed, generated, failed, configured,
  missing, or equivalent subsets never opens an unfiltered list.
- URLs preserve cross-page drilldown filters and browser back returns to the
  originating dashboard.
- Keyboard users can tab to and activate every statistic drilldown.
- No table-cell number, date, ID, pagination control, or nonnumeric status is
  accidentally converted into a drilldown.
