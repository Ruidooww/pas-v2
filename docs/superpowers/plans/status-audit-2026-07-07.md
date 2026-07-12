# PAS Plan Status Audit - 2026-07-12

This audit is the current dispatch source for PAS V0-V3 code-layer work. The
older files in `docs/superpowers/plans/` remain useful as implementation notes,
but many unchecked boxes in those files are stale after PRs `#35` through `#47`.
Do not use historical checkbox state alone to decide what still needs coding.

## Evidence Checked

- The current application-code baseline is
  `7bbaa1c fix: harden AI model operations after review`. The later
  release-evidence commit changes documentation only.
- `pnpm test` passed: backend `67` files / `364` tests and frontend `16`
  files / `73` tests.
- `pnpm typecheck`, `pnpm build`, `pnpm compose:config`, and
  `pnpm test:smoke` passed.
- Frontend authenticated pages now load through route-level chunks. The build
  emits 37 JavaScript chunks; the entry chunk is `164.07 kB` before gzip, the
  largest shared chunk is `527.72 kB`, and the previous 800 kB bundle warning
  is gone.
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
- `scripts/smoke-local-menu.mjs` validates 6 primary menus and 24 visible
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
- The tracked V1 candidate set now contains 100 unique pending questions across
  16 categories, with no exact question overlap with the V0 set. The baseline
  real-mode run at commit `a807a16` returned `answered=100`, `no_hit=0`,
  `error=0`, with 500 citations, but semantic review found obvious mismatches in
  `V1-Q003`, `V1-Q076`, `V1-Q077`, `V1-Q099`, and `V1-Q100`.
- Commit `4f84de2` added a tracked seven-chunk Technical Department operational
  knowledge baseline and synchronized it to one new RAGFlow virtual document
  without changing the existing 50 documents. A five-question rerun placed the
  new document in all three answer-producing citation positions for each known
  mismatch.
- The post-remediation 100-question run at `4f84de2` returned `answered=100`,
  `no_hit=0`, `error=0`, with 500 citations; average runtime was 1352 ms and P95
  was 2324 ms. The new document entered the top three for 44 questions. Most are
  adjacent product or permission topics, but at least eight low-score cross-topic
  hits still need human classification or dedicated knowledge. The reviewer is
  still unassigned and all human-review fields remain pending.
- The live PAS knowledge-document metadata catalog remains empty. External QA
  therefore still uses compatibility mode, so the post-remediation run does not
  prove live fail-closed filtering despite the ACL code and prior isolated M9
  permission smoke.
- Both HYYN application images were rebuilt from the AI-model implementation
  baseline. All four HYYN containers were healthy; `/api/health` and the
  read-only RAGFlow model overview returned `ok` through the frontend entry
  point.
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
- AI model access is code-ready at `/system/ai-models`: the admin-only page and
  APIs support encrypted singleton persistence, endpoint allowlisting,
  OpenAI-compatible providers, sanitized audit metadata, HTTPS-only writes,
  read-only RAGFlow state, and deterministic fallback for QA, customer
  analysis, and proposal generation. Independent review closed all five
  reported findings and returned `Ready to merge? Yes`.
- Real model activation is not release-ready in the current local `.env`:
  `LLM_CLIENT_MODE=mock`, while `MODEL_CONFIG_ENCRYPTION_KEY`,
  `MODEL_ENDPOINT_ALLOWLIST`, and `LLM_API_KEY` are unset. The local entry point
  remains HTTP with `COOKIE_SECURE=false` and is limited to loopback prechecks.
- This is not formal go-live approval. The technical artifact now has 50 unique
  questions and per-question citations, and a Technical Department reviewer is
  assigned. The gate still lacks reviewer pass/fail decisions, review
  timestamps, and a persisted regression run with `gateStatus=passed` and
  `canGoLive=true`.
- The captured V0 50-question artifact predates the AI-model application
  baseline. After HTTPS, document-metadata enrollment, and real-model activation
  are finalized, the 50 questions must be rerun before the reviewer signs the
  final release gate.

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
| V1 knowledge operations | Code-ready; M9 permission model verified; live catalog not enrolled | The active Technical Department tree maintains knowledge. Document metadata supports five visibility scopes and applies fail-closed retrieval filtering when enrolled, but the current external QA dataset still runs in empty-catalog compatibility mode. |
| V2 business flow | Code-ready | Opportunity, meeting, contract/after-sales, feedback, and metrics paths are implemented on fake/internal data. File/data ingestion is explicitly deferred. |
| V3 platform | Code-ready | Platform dashboard/service/controller/store code exists. User-facing menu now exposes the platform access surface under system settings. |
| Navigation/UI shell | Code-ready | Primary menu groups, left secondary menus, horizontal tertiary tabs, lazy authenticated page chunks with a stable loading state, admin menu configuration, polished empty states, deprecated-list cleanup, and deprecated-Alert cleanup are implemented and smoke-covered. |
| System/admin pages | Code-ready | Account permissions now include active role-compatible organization units and project groups. Organization management, audit logs, data/attachments, menu config, runtime config, and platform access have backend-backed pages or smoke endpoints. |
| AI model access | Code-ready; real provider activation deferred | Admin-only configuration, encrypted persisted secrets, provider test/save/disable, runtime fallback, QA/customer-analysis/proposal integration, and read-only RAGFlow status are implemented. Persistent deployment secrets, HTTPS, endpoint allowlisting, and a real provider credential are still required. |

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
- Formal human-reviewed V1 100-question regression gate. The tracked candidate
  set, known-mismatch remediation, and post-remediation 100/100 technical run are
  available. A reviewer still needs to approve or revise the question set,
  classify the remaining weak or cross-topic answers, record all 100 decisions
  and timestamps, and submit the persisted regression run.
- Reviewed visibility assignments for the 51 live RAGFlow documents. PAS metadata
  must be aligned to those document IDs before the trial can claim live
  fail-closed ACL behavior; bulk enrollment without per-document visibility
  review could incorrectly expose or suppress knowledge.
- Real CRM integration remains paused until the user reopens it and provides
  API documentation, auth method, test account, and sample customer records.
- The current export templates are accepted for the internal trial; replacement
  business templates will be provided later.
- Persistent `MODEL_CONFIG_ENCRYPTION_KEY`, exact
  `MODEL_ENDPOINT_ALLOWLIST`, real provider credentials, and the approved model
  name/base URL in the deployment environment. These values are intentionally
  absent from source control.
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

1. Publish the `7bbaa1c` application baseline, terminate HTTPS for the intranet
   entry point, persist the model encryption key and endpoint allowlist, and
   activate the approved real provider through the admin page.
2. Review visibility for all 51 live RAGFlow documents, enroll the approved PAS
   metadata mapping, and run same-user before/after organization and
   project-group revocation checks before treating ACL answers as live
   fail-closed evidence.
3. Rerun the V0 50-question suite against the finalized HTTPS, ACL, and model
   configuration. Complete the Technical Department review and submit a passing
   regression run before treating the project as release-ready. The current
   export templates remain the trial baseline.
4. Assign a reviewer to approve or revise all 100 V1 questions, review the
   post-remediation answers and citations, and add dedicated approved knowledge
   for any confirmed weak or cross-topic cases before the final 100-case rerun.
5. Keep code work on the current fake-data boundary unless the user provides
   real CRM, template, or source-data inputs.
6. For UI changes, update both the frontend shell and
   `scripts/smoke-local-menu.mjs` so every visible secondary menu keeps a
   backend-backed smoke check.
7. Treat the 50/100-question sets as final quality gates, not as blockers for
   normal code polishing.
8. Before opening new V0-V3 implementation issues, check this audit first and
   avoid re-dispatching already merged code layers.
