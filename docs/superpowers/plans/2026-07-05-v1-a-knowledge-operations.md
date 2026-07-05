# V1-A Knowledge Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or execute this plan task-by-task in the current isolated worktree. Follow test-first implementation for production code.

**Goal:** Implement V1 knowledge block lifecycle and citation metadata expansion while leaving the V0 50-question regression gate untouched.

**Architecture:** Add `KnowledgeModule` to the NestJS backend. The module owns `KnowledgeBlockService`, `KnowledgeBlockController`, type definitions, and tests. Persistence uses the existing `PersistenceSink` pattern with a new `KnowledgeBlockSnapshot` Prisma model. QA citation enhancement extends existing `KnowledgeChunk` and `QaCitation` types without changing the QA endpoint route.

**Tech Stack:** NestJS 11, TypeScript 6, Prisma 6, Vitest.

---

### Task 1: Citation Metadata Expansion

**Files:**
- Modify: `apps/backend/src/ragflow/knowledge-chunk.ts`
- Modify: `apps/backend/src/ragflow/ragflow.client.ts`
- Modify: `apps/backend/src/ragflow/ragflow.client.spec.ts`
- Modify: `apps/backend/src/qa/qa.types.ts`
- Modify: `apps/backend/src/qa/qa.service.ts`
- Modify: `apps/backend/src/qa/qa.service.spec.ts`

- [ ] Add failing tests proving RAGFlow payloads with `page`, `section`, `position`, `location`, and snippet-like fields map into `KnowledgeChunk`.
- [ ] Add failing tests proving QA citations expose the optional metadata and still pass when old payloads omit it.
- [ ] Implement optional fields only; do not make existing payloads invalid.

### Task 2: Knowledge Block Types And Service

**Files:**
- Create: `apps/backend/src/knowledge/knowledge.types.ts`
- Create: `apps/backend/src/knowledge/knowledge.service.ts`
- Create: `apps/backend/src/knowledge/knowledge.tokens.ts`
- Create: `apps/backend/src/knowledge/knowledge.service.spec.ts`

- [ ] Add failing tests for draft creation by presales/admin.
- [ ] Add failing tests for submit-review, approve/publish, reject, disable, and invalid transitions.
- [ ] Add failing tests for role boundaries: sales cannot create/review; presales cannot approve; admin can approve.
- [ ] Add failing tests for `listPublishedBlocks()` excluding draft, rejected, disabled, and expired blocks.
- [ ] Implement minimal in-memory service with explicit lifecycle checks.

### Task 3: Knowledge Block Persistence

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/src/knowledge/knowledge.service.spec.ts`

- [ ] Add failing tests proving service seeds from persisted blocks and mirrors mutations.
- [ ] Add `KnowledgeBlockSnapshot` with JSON payload and searchable owner/status indexes.
- [ ] Implement `mirrorKnowledgeBlock()` and `loadKnowledgeBlocks()` in `PersistenceSink`.

### Task 4: Knowledge Block Controller And Module

**Files:**
- Create: `apps/backend/src/knowledge/knowledge.controller.ts`
- Create: `apps/backend/src/knowledge/knowledge.module.ts`
- Create: `apps/backend/src/knowledge/knowledge.controller.spec.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/auth/internal-api-auth.guard.ts`

- [ ] Add failing controller tests for create/list/get/submit-review/review/disable routes.
- [ ] Implement controller and module wiring.
- [ ] Ensure `/api/internal/knowledge-blocks` stays protected by the existing guard.

### Task 5: Docs And Verification

**Files:**
- Modify: `README.md` or `apps/backend/README.md` only if the endpoint surface needs operator documentation.

- [ ] Run `pnpm --filter pas-backend test`.
- [ ] Run `pnpm --filter pas-backend typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm compose:config`.
- [ ] Run `git diff --check`.
- [ ] Confirm no `RegressionService` 50/100 gate changes are present in this batch.

---

## Out Of Scope For This Batch

- 50/100-question regression gate.
- Real CRM API integration.
- Real company template upload.
- RAGFlow compose, volumes, or dataset mutation.
