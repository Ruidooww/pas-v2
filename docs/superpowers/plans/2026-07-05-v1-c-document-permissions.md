# V1-C Document Permission Foundation Plan

> **For agentic workers:** Follow test-first implementation. Do not change the 50/100 regression gate in this batch.

**Goal:** Add document-level visibility metadata and enforce it before QA answers can use retrieved chunks, while preserving V0 behavior when no document catalog exists.

**Boundary:** RAGFlow remains external. PAS cannot mutate RAGFlow ACLs in this batch. PAS enforces access before chunks leave the backend adapter and before LLM drafting.

---

### Task 1: Document Visibility Model

**Files:**
- Modify: `apps/backend/src/knowledge/knowledge.types.ts`
- Modify: `apps/backend/src/knowledge/knowledge-document.service.ts`
- Modify: `apps/backend/src/knowledge/knowledge-document.service.spec.ts`

- [ ] Add `visibility` to `KnowledgeDocument`.
- [ ] Support public, role-scoped, and user-scoped visibility.
- [ ] Add `hasDocuments()` and `getAccessibleDocumentIds(user)`.
- [ ] Keep sales read access limited to enabled, parsed, visible documents.

### Task 2: RAGFlow Chunk Filtering

**Files:**
- Modify: `apps/backend/src/ragflow/ragflow.client.ts`
- Modify: `apps/backend/src/ragflow/ragflow.client.spec.ts`

- [ ] Add optional `allowedDocumentIds` to retrieval request.
- [ ] Filter chunks by document id before returning them to callers.
- [ ] Treat an explicit empty allow-list as fail-closed.

### Task 3: QA Integration

**Files:**
- Modify: `apps/backend/src/qa/qa.types.ts`
- Modify: `apps/backend/src/qa/qa.service.ts`
- Modify: `apps/backend/src/qa/qa.service.spec.ts`
- Modify: `apps/backend/src/qa/qa.module.ts`

- [ ] Pass authenticated user into `QaService`.
- [ ] Inject `KnowledgeDocumentService`.
- [ ] When document catalog exists, pass accessible document ids to RAGFlow retrieval.
- [ ] When catalog is empty, keep V0 retrieval behavior.

### Task 4: Frontend Metadata

**Files:**
- Modify: `apps/frontend/src/types.ts`
- Modify: `apps/frontend/src/pages/KnowledgeDocumentsPage.tsx`
- Modify: `apps/frontend/src/pages/KnowledgeDocumentsPage.test.tsx`

- [ ] Show visibility scope in document operations list.
- [ ] Register documents as public by default.

### Task 5: Verification

- [ ] Run `pnpm -r test`.
- [ ] Run `pnpm -r typecheck`.
- [ ] Run `pnpm -r build`.
- [ ] Run `pnpm compose:config`.
- [ ] Run `git diff --check`.
