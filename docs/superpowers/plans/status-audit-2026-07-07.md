# PAS Plan Status Audit - 2026-07-10

This audit is the current dispatch source for PAS V0-V3 code-layer work. The
older files in `docs/superpowers/plans/` remain useful as implementation notes,
but many unchecked boxes in those files are stale after PRs `#35` through `#47`.
Do not use historical checkbox state alone to decide what still needs coding.

## Evidence Checked

- The M9 implementation and internal-trial acceptance baseline before this
  evidence update is `2c99eff docs: add internal trial acceptance evidence`.
- `pnpm test` passed: backend `58` files / `272` tests and frontend `15`
  files / `59` tests.
- `pnpm typecheck`, `pnpm build`, `pnpm compose:config`, and
  `pnpm test:smoke` passed.
- Frontend authenticated pages now load through route-level chunks. The build
  emits 33 JavaScript chunks; the entry chunk is `145.44 kB` before gzip
  (`47.35 kB` after gzip), the largest shared chunk is `545.56 kB`, and the
  previous 800 kB bundle warning is gone.
- M9 seeds `Company`, `Sales Department`, and `Technical Department`, with
  Presales, Technical, and After-sales child teams under the Technical
  Department. Runtime roles are now only `sales`, `technical`, and `admin`.
- Persisted legacy `presales` role values are normalized to `technical` in the
  Presales Team. Role-bearing inactive units invalidate sessions, while an
  inactive project group revokes only that group grant.
- Document visibility now supports public, roles, users, organization units,
  and project groups. New documents default to the Technical Department;
  enabled/parsed filtering and empty-catalog compatibility remain intact.
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
  RAGFlow. CRM remained in mock mode. That earlier run allowed missing template
  metadata through `-AllowMissingExportTemplates`; a later acceptance run
  passed without that flag and rendered through all three current system
  templates. Those templates are accepted only for the internal trial and are
  not approved branded business templates.
- The M9 live permission smoke used a temporary legacy database row and
  temporary API records. It verified migration to the Presales Team, all three
  Technical Department child teams maintaining documents, sales mutation
  rejection, project-authorized sales read, and no document-id leak to an
  unrelated sales user. Cleanup restored the original organization snapshot
  and removed all `m9-smoke-*` users and documents.
- The formal `2026-07-10` V0 technical run executed all 50 unique approved
  candidate questions against real-mode RAGFlow at commit `da15ce6`. It returned
  `answered=50`, `no_hit=0`, `error=0`, with five citations per question and
  250 citations in total. The local ignored JSON and reviewer worksheet retain
  every answer, citation, reviewer assignment, and pending human-review field.
- Both HYYN application images were rebuilt from the M9 worktree. All four
  HYYN containers were healthy; `/api/health` and `/api/ragflow/health`
  returned `ok` through the frontend entry point.
- The live Redis password is now persisted in the ignored local `.env`, and a
  fresh Compose/runtime comparison found no critical configuration mismatch.
  The localhost HTTP precheck intentionally uses `COOKIE_SECURE=false`; an
  actual multi-user intranet trial must terminate HTTPS and restore
  `COOKIE_SECURE=true`.
- Browser checks passed at `1280x720` and `390x844`: account/organization and
  document-visibility pages had no horizontal overflow, clipped labels, or
  overlapping control groups. A discovered login-credential autofill issue in
  the new-account form was fixed and reverified with all three fields empty.
- Route-splitting browser checks passed at the same desktop and mobile sizes:
  authenticated navigation loaded the account and audit chunks, the loading
  fallback cleared, and neither viewport introduced document-level horizontal
  overflow.
- This is not formal go-live approval. The technical artifact now has 50 unique
  questions and per-question citations, and a Technical Department reviewer is
  assigned. The gate still lacks reviewer pass/fail decisions, review
  timestamps, and a persisted regression run with `gateStatus=passed` and
  `canGoLive=true`.

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
| V0 CRM mock context | Code-ready; real CRM paused | Uses fake/mock customer profiles. Real CRM integration is explicitly deferred for the internal trial. |
| V0 QA citations | Code-ready; 50/50 retrieval precheck passed | `/api/internal/qa/ask` returned answers and citations for all 50 candidate questions. Real answer correctness remains gated by human review. |
| V0 customer analysis | Code-ready | Uses deterministic customer context and evidence shape over fake/mock data. |
| V0 proposal generation | Code-ready | Proposal generation, job detail, retry, and job list APIs are implemented and UI-backed. |
| V0 export | Code-ready | Export jobs and template registry are implemented. Real customer templates are expected to be uploaded later. |
| V0 feedback/regression | Code-ready; formal gate deferred | Feedback APIs exist and the 50-question technical run passed. Reviewer-signed evidence and pass/fail decisions remain the final go-live gate. |
| Feishu reservation | Code-ready as disabled integration | Backend route exists as a reserved channel; real bot rollout is still disabled by config. |
| V1 knowledge operations | Code-ready; M9 permission model verified | The active Technical Department tree maintains knowledge. Document metadata supports five visibility scopes and applies fail-closed retrieval filtering. |
| V2 business flow | Code-ready | Opportunity, meeting, contract/after-sales, feedback, and metrics paths are implemented on fake/internal data. File/data ingestion is explicitly deferred. |
| V3 platform | Code-ready | Platform dashboard/service/controller/store code exists. User-facing menu now exposes the platform access surface under system settings. |
| Navigation/UI shell | Code-ready | Primary menu groups, left secondary menus, horizontal tertiary tabs, lazy authenticated page chunks with a stable loading state, admin menu configuration, polished empty states, deprecated-list cleanup, and deprecated-Alert cleanup are implemented and smoke-covered. |
| System/admin pages | Code-ready | Account permissions now include active role-compatible organization units and project groups. Organization management, audit logs, data/attachments, menu config, runtime config, and platform access have backend-backed pages or smoke endpoints. |

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

- Formal human-reviewed V0 50-question regression gate. The technical run and
  captured citations are available, but the reviewer must still record all 50
  decisions and timestamps before submitting the persisted regression run.
- Final V1 100-question regression gate.
- Real CRM integration remains paused until the user reopens it and provides
  API documentation, auth method, test account, and sample customer records.
- The current export templates are accepted for the internal trial; replacement
  business templates will be provided later.
- Production LLM/API keys and secret material in local or deployment env files.
- Business-material inputs for higher-quality proposal and analysis content.
- File/data ingestion. Current direction is to keep using fake data until the
  user explicitly reopens ingestion work.
- Formal registry/release-environment rollout. Secure cookies, frontend
  security headers, trusted proxy handling, and TLS termination guidance are
  now implemented; registry credentials and the actual HTTPS terminator remain
  environment work.
- Broad CSS/inline-style restructuring remains deferred until a concrete UI
  maintenance problem or redesign pass.

## Next Dispatch Guidance

1. Complete the Technical Department review of the captured V0 50-question
   artifact and submit a passing regression run before treating the project as
   release-ready. Local trial secrets are persisted; production secrets remain
   an environment responsibility. The current export templates remain the
   trial baseline.
2. Keep code work on the current fake-data boundary unless the user provides
   real CRM, template, or source-data inputs.
3. For UI changes, update both the frontend shell and
   `scripts/smoke-local-menu.mjs` so every visible secondary menu keeps a
   backend-backed smoke check.
4. Treat the 50/100-question sets as final quality gates, not as blockers for
   normal code polishing.
5. Before opening new V0-V3 implementation issues, check this audit first and
   avoid re-dispatching already merged code layers.
