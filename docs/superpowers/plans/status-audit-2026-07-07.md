# PAS Plan Status Audit - 2026-07-10

This audit is the current dispatch source for PAS V0-V3 code-layer work. The
older files in `docs/superpowers/plans/` remain useful as implementation notes,
but many unchecked boxes in those files are stale after PRs `#35` through `#47`.
Do not use historical checkbox state alone to decide what still needs coding.

## Evidence Checked

- The implementation head before this audit update is
  `f6e9b2f fix: restore RAGFlow regression retrieval` on `main`.
- `main` through `f4e2db5` was pushed to `origin/main` before this retrieval
  and regression follow-up.
- GitHub returned no open issues and no open pull requests on `2026-07-10`.
- `pnpm test` passed: backend `55` files / `236` tests and frontend `12`
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
- The `2026-07-10` live V0 smoke passed against newly rebuilt PAS containers at
  `http://127.0.0.1:18000`, real PostgreSQL, and the configured external
  RAGFlow. CRM remained in mock mode, and missing approved export templates
  were allowed only through the explicit `-AllowMissingExportTemplates` flag.
- The live 50-question technical precheck completed with `answered=50`,
  `no_hit=0`, and `error=0`. The runner respected the production QA throttle by
  waiting on `429`, and retrieval recovered from a deterministic RAGFlow
  keyword-parser error through the existing prefixed fallback query.
- This is not the formal go-live approval. The candidate JSON has 50 unique
  question IDs but no reviewer, review timestamp, expected evidence, captured
  citations, or human pass/fail record; the regression template still defines
  it as a candidate source rather than an approval artifact.

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
| V0 RAGFlow adapter | Code-ready; technical precheck passed | RAGFlow remains external. Empty PAS document metadata no longer suppresses all external retrieval, while configured metadata still applies fail-closed ACL filtering. Human answer-quality approval remains deferred. |
| V0 CRM mock context | Code-ready | Uses fake/mock customer profiles. Real CRM API integration is blocked until external API docs, auth, test account, and sample data are provided. |
| V0 QA citations | Code-ready; 50/50 retrieval precheck passed | `/api/internal/qa/ask` returned answers and citations for all 50 candidate questions. Real answer correctness remains gated by human review. |
| V0 customer analysis | Code-ready | Uses deterministic customer context and evidence shape over fake/mock data. |
| V0 proposal generation | Code-ready | Proposal generation, job detail, retry, and job list APIs are implemented and UI-backed. |
| V0 export | Code-ready | Export jobs and template registry are implemented. Real customer templates are expected to be uploaded later. |
| V0 feedback/regression | Code-ready; formal gate deferred | Feedback APIs exist and the 50-question technical run passed. Reviewer-signed evidence and pass/fail decisions remain the final go-live gate. |
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

- Formal human-reviewed V0 50-question regression gate. Technical retrieval is
  `50/50`, but the candidate set still needs reviewer identity, review time,
  expected evidence, captured citations, and pass/fail decisions.
- Final V1 100-question regression gate.
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
- Persist a strong `REDIS_PASSWORD` in the local/deployment secret store. The
  live refresh used a process-only random value because `.env` still lacks it.

## Next Dispatch Guidance

1. Persist the deployment secrets, install approved export templates, and turn
   the successful V0 50-question technical run into a reviewer-signed gate
   artifact before treating the project as release-ready.
2. Keep code work on the current fake-data boundary unless the user provides
   real CRM, template, or source-data inputs.
3. For UI changes, update both the frontend shell and
   `scripts/smoke-local-menu.mjs` so every visible secondary menu keeps a
   backend-backed smoke check.
4. Treat the 50/100-question sets as final quality gates, not as blockers for
   normal code polishing.
5. Before opening new V0-V3 implementation issues, check this audit first and
   avoid re-dispatching already merged code layers.
