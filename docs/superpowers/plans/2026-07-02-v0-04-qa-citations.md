# V0-04 QA Citations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V0 backend QA endpoint that retrieves RAGFlow chunks, generates a review-required draft answer, returns citations, and records audit events.

**Architecture:** `QaController` exposes `POST /api/internal/qa/ask`. `QaService` validates input, calls `RagflowClient`, passes retrieved chunks to a server-side draft provider, maps citations, and writes in-memory audit records. V0 uses a deterministic local draft provider so the chain runs without committing LLM credentials; real LLM provider wiring can replace the provider behind the same interface later.

**Tech Stack:** NestJS 11, TypeScript 6, Vitest.

---

### Task 1: QA Types, Config, And Audit Log

**Files:**
- Create: `apps/backend/src/qa/qa.types.ts`
- Create: `apps/backend/src/qa/qa.config.ts`
- Create: `apps/backend/src/qa/qa-audit-log.service.ts`
- Test: `apps/backend/src/qa/qa-audit-log.service.spec.ts`

- [ ] Write tests for audit log append/list behavior and redaction boundaries.
- [ ] Implement minimal in-memory audit log service.

### Task 2: QA Service

**Files:**
- Create: `apps/backend/src/qa/qa.service.ts`
- Create: `apps/backend/src/qa/qa-draft.provider.ts`
- Test: `apps/backend/src/qa/qa.service.spec.ts`

- [ ] Write tests for successful answer with citations.
- [ ] Write tests for no-hit response without fabricated citations.
- [ ] Write tests for stable RAGFlow failure response.
- [ ] Implement service and deterministic draft provider.

### Task 3: QA Controller And Module

**Files:**
- Create: `apps/backend/src/qa/qa.controller.ts`
- Create: `apps/backend/src/qa/qa.module.ts`
- Create: `apps/backend/src/qa/qa.tokens.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/qa/qa.controller.spec.ts`

- [ ] Write tests for `POST /api/internal/qa/ask` validation and delegation.
- [ ] Implement controller/module and import `QaModule` into `AppModule`.

### Task 4: Docs And Runtime Defaults

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `apps/backend/README.md`

- [ ] Document `QA_TOP_K`.
- [ ] Document that QA answers require human review and must include real citations when hits exist.

### Task 5: Verification And PR

**Files:**
- All touched files.

- [ ] Run backend tests and typecheck.
- [ ] Run full repo `lint`, `typecheck`, `test`, `build`, `compose:config`, and `git diff --check`.
- [ ] Smoke `POST /api/internal/qa/ask` in dev mode with `RAGFLOW_CLIENT_MODE=disabled` to verify stable no-hit/error shape.
- [ ] Commit with `feat: add qa citations endpoint`.
- [ ] Open Draft PR referencing `#4`.

---

## Self-Review

- Spec coverage: backend QA API, RAGFlow adapter use, citations, no-hit behavior, stable failure shape, audit logging, and backend-only boundaries are covered.
- Known blocked scope: login-user identity is a #8 dependency; real external LLM credentials are not committed or required for V0 skeleton.
- Placeholder scan: no placeholder implementation instructions remain.
