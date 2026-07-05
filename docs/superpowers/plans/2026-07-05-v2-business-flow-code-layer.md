# V2 Business Flow Code Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V2 code-layer business loop while deferring real business-material inputs.

**Architecture:** Add a focused `BusinessFlowModule` that owns V2 records, deterministic business actions, role filtering, optional snapshot persistence, and metrics. Reuse `CrmClient`, `ProposalService`, and existing frontend API patterns.

**Tech Stack:** NestJS, TypeScript, Vitest, Prisma snapshot tables, React, Ant Design.

---

### Task 1: Backend Types, Store, and Persistence

**Files:**
- Create: `apps/backend/src/business-flow/business-flow.types.ts`
- Create: `apps/backend/src/business-flow/business-flow-store.service.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.spec.ts`
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/0003_v2_business_flow_snapshots/migration.sql`

- [ ] Write failing store and persistence tests for cloning, seeding, role-filtered listing support, and mirror/load.
- [ ] Implement `BusinessFlowRecord`, append-only events, and snapshot mirror/load.
- [ ] Run `pnpm --filter backend test -- business-flow-store persistence-sink`.

### Task 2: BusinessFlowService

**Files:**
- Create: `apps/backend/src/business-flow/business-flow.service.ts`
- Create: `apps/backend/src/business-flow/business-flow.service.spec.ts`

- [ ] Write failing tests for opportunity extraction, confirmation, sync request gating, meeting summary, meeting proposal handoff, contract review, after-sales answer/reminders, channel context, customer signal analysis, metrics, and role filtering.
- [ ] Implement deterministic parsing and generation helpers with no external-provider assumptions.
- [ ] Run `pnpm --filter backend test -- business-flow.service`.

### Task 3: Controller and Module Wiring

**Files:**
- Create: `apps/backend/src/business-flow/business-flow.controller.ts`
- Create: `apps/backend/src/business-flow/business-flow.controller.spec.ts`
- Create: `apps/backend/src/business-flow/business-flow.module.ts`
- Create: `apps/backend/src/business-flow/business-flow.tokens.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/app.module.spec.ts`

- [ ] Write failing controller tests for authenticated-user ownership, request validation, and error mapping.
- [ ] Implement the V2 REST API under `/api/internal/business-flows`.
- [ ] Wire the module into `AppModule`.
- [ ] Run `pnpm --filter backend test -- business-flow.controller app.module`.

### Task 4: Frontend V2 Console

**Files:**
- Modify: `apps/frontend/src/types.ts`
- Create: `apps/frontend/src/pages/BusinessFlowsPage.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/App.test.tsx`
- Modify: `apps/frontend/src/styles.css`

- [ ] Write failing frontend tests that an authenticated user can see the V2 sidebar entry and page title.
- [ ] Add typed API models and a compact tabbed V2 console.
- [ ] Keep layout consistent with the existing Ant Design shell.
- [ ] Run `pnpm --filter frontend test`.

### Task 5: Verification and PR

**Files:**
- All files changed above.

- [ ] Run `pnpm -r test`.
- [ ] Run `pnpm -r typecheck`.
- [ ] Run `pnpm -r build`.
- [ ] Run `pnpm compose:config`.
- [ ] Run `git diff --check`.
- [ ] Commit with `feat: add v2 business flow code layer`.
- [ ] Push `codex/v2-code-layer`, open PR, wait for CI, merge if green, and fast-forward local `main`.
