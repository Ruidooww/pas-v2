# PAS V1 Operations SOP

This SOP is the non-gate V1 operating procedure. It assumes V0 remains the rollback baseline and RAGFlow stays external.

## Hard Boundaries

- PAS owns only `HYYN-frontend`, `HYYN-backend`, `HYYN-postgres`, and `HYYN-redis`.
- RAGFlow remains external and is reached through `RAGFLOW_BASE_URL`.
- Do not run `docker compose down -v` against RAGFlow.
- Do not delete existing `ragflow_*` Docker volumes.
- Do not commit `.env`, passwords, API keys, JWT secrets, registry credentials, Feishu secrets, or RAGFlow keys.
- Keep `external/ragflow/` and `backups/` out of Git.
- The final 50/100 regression gate is run only after the approved question set is ready.

## Roles

| Role | V1 operating responsibility |
| --- | --- |
| `admin` | User/account setup, audit review, knowledge operations, template operations, release approval |
| `technical` | Technical Department knowledge maintenance, including the Presales Team, Technical Team, and After-sales Team |
| `sales` | Read published knowledge, ask QA questions, generate reviewed drafts |

## Organization And Permission SOP

- The seeded hierarchy is `Company` -> `Sales Department` and `Technical Department`; the Technical Department contains `Presales Team`, `Technical Team`, and `After-sales Team`.
- A `technical` account must belong to an active unit in the Technical Department subtree. All three child teams can maintain knowledge documents.
- A `sales` account must belong to an active unit in the Sales Department subtree. Project groups provide explicit cross-department document grants.
- Legacy persisted role value `presales` is migration input only. On hydration it becomes role `technical` in `org-technical-presales`.
- Disabling a role-bearing unit immediately invalidates affected sessions. Disabling a project group revokes that group grant without invalidating the user's role membership.
- Account role changes must select a currently active compatible unit. The `org-company` switch remains protected in the UI to avoid invalidating every account at once.

## Knowledge Document SOP

Use the **文档运营** page for PAS-owned metadata over RAGFlow documents.

1. Register each selected RAGFlow document with `documentId`, title, product, material type, source name, tags, and visibility. New documents default to `organization_units=[org-technical]`.
2. Keep `parseStatus=done` only for documents that RAGFlow has parsed successfully.
3. Disable documents that are obsolete, duplicated, legally sensitive, or repeatedly causing bad answers.
4. Use reparse requests when the source file has been replaced or parsing quality is poor.
5. Sales users only see enabled, parsed, visible documents.
6. When any document metadata exists, QA retrieval is filtered by the authenticated user's accessible document ids. An empty accessible list fails closed.
7. Visibility can target everyone, current roles, named users, organization units, or active project groups. Existing visibility is preserved when an upsert omits it.
8. `technical` users in the active Technical Department tree and administrators can mutate document metadata; sales mutations are rejected.

## Knowledge Block SOP

Use the **知识块运营** page for reusable deterministic content.

1. Create draft blocks from approved product facts, RAGFlow citations, feedback fixes, or historical proposal text.
2. Submit drafts for review after the body, product, scenario, tags, and citations are complete.
3. Publish only blocks that can be safely reused in proposal and export flows.
4. Reject blocks with unclear source, weak wording, or missing citation context.
5. Disable published blocks when product positioning changes or the source material is no longer valid.
6. Only published blocks are valid deterministic fill sources for later ProposalModule and ExportModule expansion.

## Template SOP

Use the **模板运营** page for docx, pptx, and xlsx template metadata.

1. Register template metadata before activating it: template id, name, format, version, file name, products, scenarios, and tags.
2. Keep new templates in `draft` until the real file exists under `EXPORT_TEMPLATE_ROOT`.
3. Activate one or more usable templates per format only after the file is present and renderer tests pass.
4. Disable old templates instead of deleting metadata, so audit history and old export records remain explainable.
5. Template activation does not fake success: export still checks that the active file exists and that rendered output is non-empty.
6. After replacing real templates, run:

```powershell
& 'C:\Program Files\nodejs\pnpm.CMD' --filter pas-backend exec vitest run src/export/template-export.renderer.spec.ts
```

## Feedback SOP

Use the feedback API and audit trail to close answer and proposal issues.

1. Classify feedback as answer quality, citation quality, missing document, template issue, permission issue, or product wording issue.
2. For missing or poor source material, update document metadata and request reparse when needed.
3. For reusable corrections, create or update a knowledge block and route it through review.
4. For layout or export issues, update template metadata and keep the affected format disabled until renderer verification passes.
5. Keep high-risk feedback linked to a human owner before release approval.

## Release Checklist

Before V1 release approval:

- `pnpm -r test` passes.
- `pnpm -r typecheck` passes.
- `pnpm -r build` passes.
- `pnpm compose:config` validates only the four PAS services and `HYYN-*` containers, the secure cookie default, and frontend Nginx security headers.
- The public entry point terminates HTTPS in front of `pas-frontend`; `pas-backend` is not exposed directly.
- `COOKIE_SECURE=true` is set for the release environment. `false` is allowed only for local HTTP testing.
- `TRUST_PROXY_HOPS` matches the real trusted proxy count: `1` for frontend-only proxying or `2` when a separate TLS terminator fronts `pas-frontend`.
- Login uses `THROTTLE_LOGIN_LIMIT_PER_MINUTE=10` and QA uses `THROTTLE_QA_LIMIT_PER_MINUTE=30`, unless an approved environment-specific limit is documented.
- The public response includes CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and TLS-terminator `Strict-Transport-Security` headers.
- Browser smoke confirms login and the V1 operations pages load.
- Browser smoke at desktop and 390px confirms account/organization controls and document visibility controls have no horizontal overflow, clipped labels, or overlapping action groups.
- RAGFlow health is reachable when `RAGFLOW_CLIENT_MODE=real`.
- Real company templates are uploaded or the release notes explicitly mark templates as temporary.
- The final approved regression gate passes:
  - V0 compatibility runs use the default `requiredCaseCount=50`.
  - V1 launch runs must submit `requiredCaseCount=100`.
  This item is intentionally deferred until the approved set is ready.

## M9 Internal Trial Evidence - 2026-07-10

- `pnpm test` passed: backend `58` files / `272` tests; frontend `13` files / `57` tests.
- `pnpm typecheck`, `pnpm build`, `pnpm compose:config`, `pnpm test:smoke`, and `git diff --check` passed.
- `HYYN-backend`, `HYYN-frontend`, `HYYN-postgres`, and `HYYN-redis` were healthy after rebuilding the local backend and frontend images.
- `/api/health` and real-mode `/api/ragflow/health` returned `ok` through `http://127.0.0.1:18000`.
- Live migration normalized a temporary legacy `presales` record to `technical` in the Presales Team. Live authorization confirmed all three Technical Department teams could maintain documents, sales mutation returned `403`, a project-authorized sales user could read the document, and an unrelated sales user received `403` with no leaked document id.
- Temporary permission-smoke users, documents, project group state, and browser account were removed; the original organization snapshot was restored and the backend returned to healthy.
- The V0 smoke passed with the current temporary export-template boundary. Candidate questions `Q001-Q005` returned `answered=5`, `no_hit=0`, and `error=0`.
- The generated 50-question pool has a Technical Department reviewer available, but the formal human-reviewed gate remains open until each result, citations, reviewer decision, and review time are recorded.

## Rollback

Rollback remains image-tag based and must not delete volumes.

```powershell
# Set PAS_BACKEND_IMAGE and PAS_FRONTEND_IMAGE back to the previous approved commit SHA tag in .env.
docker compose --env-file .env pull pas-backend pas-frontend
docker compose --env-file .env up -d pas-backend pas-frontend
```

After rollback, rerun the V0 smoke from `docs/deployment/v0-sop.md`.
