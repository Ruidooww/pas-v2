# V1-B Knowledge Document Operations Implementation Plan

> **For agentic workers:** Follow test-first implementation. This batch must not upload to RAGFlow, mutate RAGFlow datasets, change RAGFlow compose, or alter the final 50/100 regression gate.

**Goal:** Add PAS-owned document operations metadata so admins and presales can track knowledge documents, parse state, tags, quality counters, enablement, and reparse requests.

**Architecture:** Extend the backend with a `KnowledgeDocumentService` under `KnowledgeModule`. Store records through `PersistenceSink` snapshots. Add a frontend page for document operations. This is an operations catalog over documents already managed in RAGFlow; it does not replace the RAGFlow console or call destructive RAGFlow APIs.

---

### Task 1: Document Types And Service

**Files:**
- Create: `apps/backend/src/knowledge/knowledge-document.service.ts`
- Create: `apps/backend/src/knowledge/knowledge-document.service.spec.ts`
- Modify: `apps/backend/src/knowledge/knowledge.types.ts`
- Modify: `apps/backend/src/knowledge/knowledge.tokens.ts`

- [ ] Add failing tests for document registration/upsert by admin/presales.
- [ ] Add failing tests for list/detail filters by parse status and enabled state.
- [ ] Add failing tests for tag update, enable/disable, and reparse request.
- [ ] Add failing tests for role boundaries.
- [ ] Implement a minimal in-memory service.

### Task 2: Document Persistence

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.spec.ts`

- [ ] Add `KnowledgeDocumentSnapshot`.
- [ ] Add `mirrorKnowledgeDocument()` and `loadKnowledgeDocuments()`.
- [ ] Verify service hydration via `seed()`.

### Task 3: Document Controller And Module Wiring

**Files:**
- Create: `apps/backend/src/knowledge/knowledge-document.controller.ts`
- Create: `apps/backend/src/knowledge/knowledge-document.controller.spec.ts`
- Modify: `apps/backend/src/knowledge/knowledge.module.ts`

- [ ] Add controller tests for create/list/get/tags/enable/disable/reparse.
- [ ] Wire controller under `/api/internal/knowledge-documents`.

### Task 4: Frontend Document Operations

**Files:**
- Create: `apps/frontend/src/pages/KnowledgeDocumentsPage.tsx`
- Create: `apps/frontend/src/pages/KnowledgeDocumentsPage.test.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/types.ts`
- Modify: `apps/frontend/src/styles.css`

- [ ] Add page test for loading document metadata and parse status.
- [ ] Add menu entry and usable list/create/update controls.

### Task 5: Verification

- [ ] Run `pnpm -r test`.
- [ ] Run `pnpm -r typecheck`.
- [ ] Run `pnpm -r build`.
- [ ] Run `pnpm compose:config`.
- [ ] Run `git diff --check`.
- [ ] Confirm no RAGFlow compose/volume paths and no regression gate files changed.
