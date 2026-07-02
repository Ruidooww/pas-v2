# V0-03 CRM Mock Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PAS backend CRM adapter boundary and mock customer context needed by V0 customer analysis and proposal generation.

**Architecture:** Keep CRM access server-side only. `CrmConfig` reads runtime mode, `MockCrmClient` returns a small fixed V0 demo customer set, and `CrmController` exposes backend APIs for customer list, detail, and reusable customer context. `external` mode is a reserved configuration path that fails with a sanitized error until CRM API documentation and credentials are provided.

**Tech Stack:** NestJS 11, TypeScript 6, Vitest.

---

### Task 1: CRM Config And DTOs

**Files:**
- Create: `apps/backend/src/crm/crm.config.ts`
- Create: `apps/backend/src/crm/crm.types.ts`
- Test: `apps/backend/src/crm/crm.config.spec.ts`

- [ ] Write tests for default `mock` mode and explicit `external` mode.
- [ ] Verify RED with `pnpm --filter pas-backend exec vitest run src/crm/crm.config.spec.ts`.
- [ ] Implement `createCrmConfig()` and the minimal DTOs for customer, industry, contacts, opportunity, purchased products, follow-ups, and context.
- [ ] Verify GREEN.

### Task 2: Mock CRM Client

**Files:**
- Create: `apps/backend/src/crm/mock-crm.client.ts`
- Test: `apps/backend/src/crm/mock-crm.client.spec.ts`

- [ ] Write tests for customer list, customer detail, context reuse, not-found behavior, and sanitized external-mode failure.
- [ ] Verify RED with `pnpm --filter pas-backend exec vitest run src/crm/mock-crm.client.spec.ts`.
- [ ] Implement the mock client using in-memory V0 demo profiles.
- [ ] Verify GREEN.

### Task 3: CRM Module And API

**Files:**
- Create: `apps/backend/src/crm/crm.controller.ts`
- Create: `apps/backend/src/crm/crm.module.ts`
- Create: `apps/backend/src/crm/crm.tokens.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/crm/crm.controller.spec.ts`

- [ ] Write tests for `GET /api/crm/customers`, `GET /api/crm/customers/:customerId`, and `GET /api/crm/customers/:customerId/context`.
- [ ] Verify RED with `pnpm --filter pas-backend exec vitest run src/crm/crm.controller.spec.ts`.
- [ ] Implement controller/module and import `CrmModule` into `AppModule`.
- [ ] Verify GREEN.

### Task 4: Docs And Runtime Defaults

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `apps/backend/README.md`

- [ ] Add `CRM_CLIENT_MODE=mock` to `.env.example`.
- [ ] Document that frontend and future Bot integrations call PAS backend only.
- [ ] Document remaining external CRM inputs: API docs, auth method, test account, and confirmed sample customer data.

### Task 5: Verification And PR

**Files:**
- All touched files.

- [ ] Run `pnpm --filter pas-backend test`.
- [ ] Run `pnpm --filter pas-backend typecheck`.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm compose:config`, and `git diff --check`.
- [ ] Commit with `feat: add crm mock context`.
- [ ] Open Draft PR referencing `#3`.

---

## Self-Review

- Spec coverage: CRM adapter boundary, mock mode, external mode reservation, minimum customer context DTO, backend-only APIs, and secret boundary are covered.
- Known blocked scope: real CRM API integration remains blocked by external API documentation, auth method, test account, and confirmed sample data.
- Placeholder scan: no placeholder instructions remain in the executable plan.
