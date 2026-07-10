# PAS v2 Code Review Remediation Status - 2026-07-09

This file is the current closeout table for the code-review remediation pass.
It reconciles the pure code quality review dated `2026-07-08` with the commits
that landed afterward. Use this file before dispatching more review-fix work so
already-fixed items are not re-opened.

## Evidence Checked

- Current branch: `main`.
- Current remediation head before this status refresh:
  `c866e6f fix: poll asynchronous proposal smoke`.
- Unrelated worktree content before this pass: only untracked `design-qa.md`.
  The deployment files changed alongside this document belong to this pass.
- Review source checked:
  `C:\Users\Ruidoww\Desktop\【新】pas-v2-纯代码质量审查.md`.
- Existing project status anchor checked:
  `docs/superpowers/plans/status-audit-2026-07-07.md`.

## Remediation Commits

| Commit | Status | Scope |
| --- | --- | --- |
| `a1c28c8` | Fixed | Compose now requires service passwords and Redis auth. |
| `6516637` | Fixed | Persistence sink uses explicit connect and serialized mirror writes. |
| `cbb75ed` | Fixed | Frontend API errors avoid exposing auth/server internals. |
| `21cbd91` | Fixed | Backend record IDs use crypto-backed generated IDs. |
| `3da8a55` | Fixed | Business budget parsing supports more common units. |
| `ae63974` | Fixed | Frontend API requests have timeout and safe network errors. |
| `8e3b960` | Fixed | `PersistenceModule` is explicit, not global. |
| `de023cd` | Fixed | Runtime tuning envs are exposed for throttle and LLM timeout. |
| `32eeb47` | Fixed | Proposal generation returns a running job and continues asynchronously. |
| `54d1261` | Fixed | Backend security headers include a configured CSP. |
| `bbd1df2` | Fixed | Proposal library no longer mixes sample proposals into the API. |
| `7475ced` | Fixed | Stored file names are sanitized before keys and records are created. |
| `55b4f9a` | Fixed | Frontend view state persists through browser paths. |
| `30f0822` | Fixed | Frontend customer list requests are shared per token. |
| `7264e91` | Fixed | Audit persistence writes are batched with `createMany`. |
| `20279bb` | Fixed | Snapshot hydration uses a default `take: 1000` limit. |
| `0324e24` | Fixed | Proposal `humanInputs` are validated at the request boundary. |
| `fb7f880` | Fixed | Frontend sessions use `httpOnly` cookies with CSRF protection. |
| `43f0d62` | Fixed | Frontend deployment adds browser security headers and secure cookie defaults. |
| `74672e6` | Fixed | Throttle environment values use validated shared configuration. |
| `acc07b2` | Fixed | Login and QA apply stricter endpoint limits with trusted proxy IP handling. |
| `e2eaed3` | Fixed | Compose and deployment docs expose the endpoint limits and trusted proxy topology. |
| `2e345ab` | Fixed | Throttle metadata coverage is stable in the complete backend test suite. |
| `c866e6f` | Fixed | V0 smoke polls asynchronous proposal jobs before export verification. |

## Review Item Status

| # | Review item | Current status | Decision |
| --- | --- | --- | --- |
| 1 | Prisma Client missing explicit `$connect()` | Fixed by `6516637` | No further action in this pass. |
| 2 | Persistence mirror fire-and-forget / no backpressure | Fixed by `6516637`; audit hot path improved by `7264e91` | Keep deeper queue/BullMQ out of V0 unless load requires it. |
| 3 | Postgres/Redis default weak passwords | Fixed by `a1c28c8` | No further action in this pass. |
| 4 | `Math.random()` IDs | Fixed by `21cbd91` | No further action in this pass. |
| 5 | Proposal sample data in production library | Fixed by `bbd1df2` | No further action in this pass. |
| 6 | Budget parsing misses common units | Fixed by `3da8a55` | No further action in this pass. |
| 7 | Login/server error details exposed to frontend | Fixed by `cbb75ed` | No further action in this pass. |
| 8 | QA `pre-wrap` XSS concern | Downgraded | Current React rendering escapes text and does not use `dangerouslySetInnerHTML`; do not change now. |
| 9 | Internal APIs only use bearer token, no extra protection | Fixed by `fb7f880` and `acc07b2` | Session cookies use CSRF protection; the global guard remains and login/QA now have stricter independently configurable limits with trusted proxy IP handling. |
| 10 | Token stored in `localStorage` | Fixed by auth hardening pass | Backend issues session/CSRF cookies; frontend boots from `/api/me`, sends credentials/CSRF, and no longer stores login tokens. |
| 11 | Frontend HTTP without TLS | Fixed by deployment hardening pass | Deployment SOP requires HTTPS termination in front of `pas-frontend`, keeps the backend private, and defaults session cookies to secure transport. |
| 12 | `helmet()` without CSP | Fixed by `54d1261` and deployment hardening pass | Backend Helmet remains configured; frontend Nginx now emits CSP and the required browser security headers. |
| 13 | File name filtering and path safety | Fixed by `7475ced` | No further action in this pass. |
| 14 | Persistence module marked `@Global()` | Fixed by `8e3b960` | No further action in this pass. |
| 15 | Proposal generation runs synchronously in HTTP request | Fixed by `32eeb47` | BullMQ/SSE remains a later scale-up task, not required for V0. |
| 16 | Frontend refresh loses selected page | Fixed by `55b4f9a` | Full `react-router-dom` migration is optional later architecture work. |
| 17 | Cross-page customer data repeats requests | Fixed by `30f0822` | Current lightweight cache is enough; no Redux/SWR needed yet. |
| 18 | Persistence hydration lacks limits | Fixed by `6516637` and `20279bb` | No further action in this pass. |
| 19 | `mirrorAudit()` writes one DB row per event | Fixed by `7264e91` | No further action in this pass. |
| 20 | Mock CRM uses linear `Array.find()` | Downgraded | Current data is tiny mock data; do not optimize until real or large mock datasets arrive. |
| 21 | Hard-coded defaults spread across code/config | Partially fixed | Security/runtime defaults addressed; moving all mock/default values to a config layer would be broad cleanup, not urgent. |
| 22 | Test coverage gaps / no E2E | Fixed by `ac97316` and `c866e6f` | Fake-server route smoke remains fast, and the live V0 smoke passed against rebuilt PAS containers, PostgreSQL, and external RAGFlow on `2026-07-10`. |
| 23 | Proposal `humanInputs` runtime type risk | Fixed by `0324e24` | No further action in this pass. |
| 24 | Frontend API lacks timeout/cancel/dedupe | Partially fixed | Timeout/network handling fixed by `ae63974`; blind retry/cancel remains intentionally deferred to avoid duplicate POSTs. |
| 25 | CSS and inline style maintenance debt | Open refactor task | Defer; no user-facing bug and refactor risk is broad. |

## Remaining Dispatch Queue

1. Broad UI/style cleanup.
   Defer CSS Modules/Tailwind-style restructuring until there is a concrete UI
   maintenance problem or redesign pass.

## Do Not Reopen In This Pass

- `QaPage` text rendering XSS: current JSX text rendering is escaped.
- `mock-crm.client.ts` linear lookup: not a real bottleneck with current mock
  data size.
- Blind frontend request retries: unsafe for current POST-heavy API surface.
- Full router migration: the immediate refresh/deep-link defect is already
  covered by URL state persistence.
