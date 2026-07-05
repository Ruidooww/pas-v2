# V1 Stable MVP Design

**Goal:** Move PAS from V0 usable demo to V1 stable MVP without breaking the V0 fallback path on `main`.

**Rollback rule:** V1 work stays on `codex/v1-stable-mvp` and is additive until merged. Existing V0 API contracts stay compatible; new V1 backend capabilities use new modules, fields, or endpoints.

**Deferred by user instruction:** The 50/100-question quality gate is a V1 closeout task, not part of the first implementation batch.

## V1 Delivery Train

### V1-A Knowledge Operations Foundation

Build the first durable operations layer:

- Knowledge block lifecycle: `draft`, `pending_review`, `published`, `rejected`, `disabled`, `expired`.
- Review/publish workflow for admin and presales users.
- Source tracking from RAGFlow chunk, feedback, manual entry, or historical proposal.
- Published-only query endpoint for deterministic ProposalModule and ExportModule fill in later batches.
- Citation metadata expansion from RAGFlow chunk payloads when page, section, snippet, or location data exists.

### V1-B Knowledge Base Admin

Add document/tag/status views after V1-A lands. This can reuse the same operations module and should not mutate RAGFlow volumes or compose configuration.

### V1-C Permission Completion

Add department/user/template/generation-record visibility rules. Retrieval pre-filtering must fail closed once the document visibility model exists.

### V1-D Template And Deliverable Expansion

Expand proposal/export templates using current V0 templates as fallback until real company templates are uploaded.

### V1-E Quality Gate And Launch SOP

Implement the final 50/100 regression gate, scoring reports, SOP docs, and V1 acceptance evidence.

## Current Batch Scope

This branch implements V1-A only. It intentionally does not modify `RegressionService` gate thresholds.

## Data Model

`KnowledgeBlock` is the durable V1 record. It stores title, product, scenario, body, citations, tags, version, owner, reviewer, status, source metadata, timestamps, and published timestamp.

Persistence follows the V0 snapshot pattern first: services hydrate from `PersistenceSink` and mirror mutations asynchronously. Later V1 batches can replace hot paths with full repositories without changing API contracts.

## API Shape

New endpoints live under `/api/internal/knowledge-blocks` and require the existing JWT guard:

- `POST /api/internal/knowledge-blocks` creates a draft.
- `GET /api/internal/knowledge-blocks` lists blocks, optionally filtered by `status` or `publishedOnly`.
- `GET /api/internal/knowledge-blocks/:blockId` reads one block.
- `POST /api/internal/knowledge-blocks/:blockId/submit-review` moves draft/rejected blocks to review.
- `POST /api/internal/knowledge-blocks/:blockId/review` approves/publishes or rejects a block.
- `POST /api/internal/knowledge-blocks/:blockId/disable` disables a published block.
- `GET /api/internal/knowledge-blocks/published` returns published blocks only for later deterministic fill.

## Authorization

Admin can create, review, publish, reject, disable, and list all blocks. Presales can create drafts and submit their own drafts for review. Sales can only read published blocks.

## Acceptance For V1-A

- Tests prove lifecycle transitions and role boundaries.
- Tests prove published-only query excludes draft/rejected/disabled blocks.
- Tests prove RAGFlow chunk metadata maps into QA citations without breaking old payloads.
- `pnpm --filter pas-backend test`, `pnpm --filter pas-backend typecheck`, and final repo validation pass.
