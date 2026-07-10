# PAS Plan Status Audit - 2026-07-10

This audit is the current dispatch source for PAS V0-V3 code-layer work. The
older files in `docs/superpowers/plans/` remain useful as implementation notes,
but many unchecked boxes in those files are stale after PRs `#35` through `#47`.
Do not use historical checkbox state alone to decide what still needs coding.

## Evidence Checked

- The implementation head before this audit update is
  `2e345ab test: stabilize throttle metadata coverage` on `main`.
- `main` through `2e345ab` was pushed to `origin/main` during this refresh.
- GitHub returned no open issues and no open pull requests on `2026-07-10`.
- `pnpm test` passed: backend `55` files / `232` tests and frontend `12`
  files / `43` tests.
- `pnpm typecheck`, `pnpm build`, `pnpm compose:config`, and
  `pnpm test:smoke` passed.
- The frontend build still reports one non-blocking bundle warning: the main
  JavaScript chunk is about `1.15 MB` before gzip (`354.60 kB` after gzip).
- Backend modules exist for `auth`, `audit`, `crm`, `ragflow`, `qa`,
  `customer-analysis`, `proposal`, `export`, `knowledge`, `business-flow`,
  `platform`, `menu`, `workbench`, `system`, `integration`, and `feedback`.
- Frontend pages exist for account management, audit logs, business flows,
  customer management, data/attachments, export jobs, export templates,
  feedback, knowledge blocks, knowledge documents, menu configuration,
  platform, proposal library, QA, system settings, workbench overview, and
  proposal tasks.
- `scripts/smoke-local-menu.mjs` validates 6 primary menus and 23 visible
  secondary menus, including login, `/api/health`, `/api/me`, effective menu
  loading, and at least one backend endpoint for every visible secondary menu.
- The latest real local browser smoke on `2026-07-07` passed against
  `http://127.0.0.1:5174` with backend on port `3000` after PR `#53` merged.
- The `2026-07-10` automated smoke uses a local fake server. It verifies the
  frontend route/menu contract but is not a real PostgreSQL/RAGFlow/CRM E2E.

## Scope Interpretation

`Code-ready` below means the staged V0-V3 code-layer scope has an implemented
API/UI path. It does not mean the full 15-module, 139-requirement roadmap is
complete. The detailed roadmap mapping dated `2026-07-08` estimated strict
feature coverage at about `35-40%`; later remediation commits mainly improved
security, reliability, deployment, and tests rather than adding the missing
long-range business capabilities.

## Code-Layer Status

| Area | Status | Current boundary |
| --- | --- | --- |
| V0 foundation | Code-ready | Monorepo scripts, four PAS-owned containers, HYYN container names, auth bootstrap, cookie/CSRF sessions, endpoint throttling, health, CI/build/test lanes are present. |
| V0 RAGFlow adapter | Code-ready | RAGFlow remains external. PAS reads it through backend APIs. Dataset quality gates are still deferred. |
| V0 CRM mock context | Code-ready | Uses fake/mock customer profiles. Real CRM API integration is blocked until external API docs, auth, test account, and sample data are provided. |
| V0 QA citations | Code-ready | `/api/internal/qa/ask` is wired and smoke-covered. Real answer quality remains gated by the final regression set. |
| V0 customer analysis | Code-ready | Uses deterministic customer context and evidence shape over fake/mock data. |
| V0 proposal generation | Code-ready | Proposal generation, job detail, retry, and job list APIs are implemented and UI-backed. |
| V0 export | Code-ready | Export jobs and template registry are implemented. Real customer templates are expected to be uploaded later. |
| V0 feedback/regression | Code-ready with gate deferred | Feedback APIs exist. The 50-question gate remains a final go-live gate, not a blocker for current code-layer work. |
| Feishu reservation | Code-ready as disabled integration | Backend route exists as a reserved channel; real bot rollout is still disabled by config. |
| V1 knowledge operations | Code-ready | Knowledge blocks, lifecycle review/publish, knowledge documents, document permissions, and template operations exist. |
| V2 business flow | Code-ready | Opportunity, meeting, contract/after-sales, feedback, and metrics paths are implemented on fake/internal data. File/data ingestion is explicitly deferred. |
| V3 platform | Code-ready | Platform dashboard/service/controller/store code exists. User-facing menu now exposes the platform access surface under system settings. |
| Navigation/UI shell | Code-ready | Primary menu groups, left secondary menus, horizontal tertiary tabs, admin menu configuration, polished empty states, deprecated-list cleanup, and deprecated-Alert cleanup are implemented and smoke-covered. |
| System/admin pages | Code-ready | Account permissions, audit logs, data/attachments, menu config, runtime config, and platform access all have backend-backed pages or smoke endpoints. |

## Historical Plan Files

Use these files as design notes, not live progress trackers:

- `2026-07-02-v0-01-foundation.md`
- `2026-07-02-v0-02-ragflow-adapter.md`
- `2026-07-02-v0-03-crm-mock-context.md`
- `2026-07-02-v0-04-qa-citations.md`
- `2026-07-02-v0-05-customer-analysis.md`
- `2026-07-05-v1-a-knowledge-operations.md`
- `2026-07-05-v1-b-knowledge-document-ops.md`
- `2026-07-05-v1-c-document-permissions.md`
- `2026-07-05-v1-d-template-ops-deliverable-checks.md`
- `2026-07-05-v2-business-flow-code-layer.md`
- `2026-07-05-v3-platform-code-layer.md`
- `2026-07-06-ui-secondary-menu-customization.md`

If a future task needs exact implementation proof, verify source, tests, smoke,
and GitHub PR history instead of flipping old checkboxes in place.

## Remaining Non-Code Or Deferred Inputs

- Final V0 50-question regression gate.
- Final V1 100-question regression gate.
- Real Docker-backed E2E with PostgreSQL plus the configured external RAGFlow.
- Real CRM API documentation, auth method, test account, and sample customer
  records.
- Real export templates from the user.
- Production LLM/API keys and secret material in local or deployment env files.
- Business-material inputs for higher-quality proposal and analysis content.
- File/data ingestion. Current direction is to keep using fake data until the
  user explicitly reopens ingestion work.
- Formal registry/release-environment rollout. Secure cookies, frontend
  security headers, trusted proxy handling, and TLS termination guidance are
  now implemented; registry credentials and the actual HTTPS terminator remain
  environment work.
- Frontend route-level code splitting for the current `1.15 MB` main chunk.
- Broad CSS/inline-style restructuring remains deferred until a concrete UI
  maintenance problem or redesign pass.

## Next Dispatch Guidance

1. Add or execute a real four-container E2E lane before treating the project as
   release-ready; keep RAGFlow external and do not mutate its volumes.
2. Keep code work on the current fake-data boundary unless the user provides
   real CRM, template, or source-data inputs.
3. For UI changes, update both the frontend shell and
   `scripts/smoke-local-menu.mjs` so every visible secondary menu keeps a
   backend-backed smoke check.
4. Treat the 50/100-question sets as final quality gates, not as blockers for
   normal code polishing.
5. Before opening new V0-V3 implementation issues, check this audit first and
   avoid re-dispatching already merged code layers.
