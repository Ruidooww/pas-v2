# V3 Platform Code Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the V3 backend and frontend code layer for platformization.

**Architecture:** Add a focused `PlatformModule` that owns V3 state, deterministic platform services, persistence snapshots, and internal API routes. Add a React `PlatformPage` that exposes the V3 dashboard, channel, Agent/Skill/workflow, product registry, CIP, tenant, and audit surfaces.

**Tech Stack:** NestJS, Vitest, Prisma snapshot persistence, React, Ant Design, Vite.

---

### Task 1: Backend Types, Store, and Persistence

**Files:**
- Create: `apps/backend/src/platform/platform.types.ts`
- Create: `apps/backend/src/platform/platform-store.service.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/0004_v3_platform_state/migration.sql`
- Test: `apps/backend/src/platform/platform-store.service.spec.ts`

- [ ] Write store tests for seeding, cloning, and persistence mirroring.
- [ ] Run `pnpm --filter pas-backend test -- platform-store.service.spec.ts` and confirm the new tests fail because files do not exist.
- [ ] Implement the V3 type model, state store, persistence mirror/load methods, Prisma model, and SQL migration.
- [ ] Re-run the store tests and confirm they pass.

### Task 2: Backend Service

**Files:**
- Create: `apps/backend/src/platform/platform.service.ts`
- Test: `apps/backend/src/platform/platform.service.spec.ts`

- [ ] Write service tests for dashboard aggregation, channel message routing, Skill review/approval, workflow run, product registration, CIP signal detection, tenant reservation, and security summary.
- [ ] Run `pnpm --filter pas-backend test -- platform.service.spec.ts` and confirm failures are missing service implementation.
- [ ] Implement deterministic service methods and seed defaults for V3 code-ready state.
- [ ] Re-run the service tests and confirm they pass.

### Task 3: Backend Controller and Module

**Files:**
- Create: `apps/backend/src/platform/platform.controller.ts`
- Create: `apps/backend/src/platform/platform.module.ts`
- Create: `apps/backend/src/platform/platform.tokens.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/platform/platform.controller.spec.ts`
- Test: `apps/backend/src/app.module.spec.ts`

- [ ] Write controller tests for required-field validation and authenticated delegation.
- [ ] Run `pnpm --filter pas-backend test -- platform.controller.spec.ts app.module.spec.ts` and confirm failures.
- [ ] Implement `/api/internal/platform` routes and register `PlatformModule`.
- [ ] Re-run controller/module tests and confirm they pass.

### Task 4: Frontend Types and Page

**Files:**
- Modify: `apps/frontend/src/types.ts`
- Create: `apps/frontend/src/pages/PlatformPage.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/styles.css`
- Test: `apps/frontend/src/App.test.tsx`

- [ ] Write frontend tests that log in, open `V3 平台化`, and assert dashboard/channel/Agent panels render from mocked API data.
- [ ] Run `pnpm --filter pas-frontend test -- App.test.tsx` and confirm the V3 assertions fail.
- [ ] Add V3 types, menu item, page, and scoped styles.
- [ ] Re-run frontend tests and confirm they pass.

### Task 5: Full Verification and Delivery

**Files:**
- All files above.

- [ ] Run `pnpm -r test`.
- [ ] Run `pnpm -r typecheck`.
- [ ] Run `pnpm -r build`.
- [ ] Run `pnpm compose:config` and confirm only the four PAS services/containers are present.
- [ ] Run a browser smoke against the V3 page.
- [ ] Commit, push `codex/v3-code-layer`, open PR, watch CI, and merge when green.
