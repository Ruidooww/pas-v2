# V0-02 RAGFlow Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PAS backend RAGFlow adapter boundary that can health-check RAGFlow, classify connection failures, and map retrieval results to PAS `KnowledgeChunk` records.

**Architecture:** Keep RAGFlow access server-side only. `RagflowConfig` reads environment variables, `RagflowClient` owns HTTP calls and result mapping, and `RagflowController` exposes PAS backend endpoints for health and search. Real V0 dataset creation stays blocked until the user provides the 30-50 source list, new dataset ID, and 50 regression questions.

**Tech Stack:** NestJS 11, TypeScript 6, Vitest, native `fetch`.

---

### Task 1: RAGFlow Configuration And Error Model

**Files:**
- Create: `apps/backend/src/ragflow/ragflow.config.ts`
- Create: `apps/backend/src/ragflow/ragflow.errors.ts`
- Test: `apps/backend/src/ragflow/ragflow.config.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { createRagflowConfig } from "./ragflow.config";
import { classifyRagflowError } from "./ragflow.errors";

describe("createRagflowConfig", () => {
  it("uses V0 defaults when optional environment values are missing", () => {
    expect(createRagflowConfig({})).toEqual({
      baseUrl: "http://host.docker.internal:19380",
      clientMode: "real",
      pasKbId: "",
      qaKbId: ""
    });
  });

  it("normalizes base URL and keeps dataset ids outside Git-tracked defaults", () => {
    expect(
      createRagflowConfig({
        RAGFLOW_BASE_URL: "http://localhost:19380/",
        RAGFLOW_CLIENT_MODE: "disabled",
        PAS_KB_ID: "pas-v0",
        QA_KB_ID: "qa-v0"
      })
    ).toEqual({
      baseUrl: "http://localhost:19380",
      clientMode: "disabled",
      pasKbId: "pas-v0",
      qaKbId: "qa-v0"
    });
  });
});

describe("classifyRagflowError", () => {
  it("classifies aborts, connection failures, http failures, and unknown errors", () => {
    expect(classifyRagflowError(new DOMException("timeout", "AbortError"))).toBe("timeout");
    expect(classifyRagflowError(new TypeError("fetch failed"))).toBe("network");
    expect(classifyRagflowError({ status: 401 })).toBe("auth");
    expect(classifyRagflowError({ status: 503 })).toBe("upstream");
    expect(classifyRagflowError(new Error("other"))).toBe("unknown");
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter pas-backend test -- ragflow.config.spec.ts`

Expected: fail because `ragflow.config` and `ragflow.errors` do not exist.

- [ ] **Step 3: Implement minimal config and error helpers**

Create the files from Step 1 with the tested behavior only.

- [ ] **Step 4: Verify the tests pass**

Run: `pnpm --filter pas-backend test -- ragflow.config.spec.ts`

Expected: pass.

### Task 2: RAGFlow Client Health And Search Mapping

**Files:**
- Create: `apps/backend/src/ragflow/knowledge-chunk.ts`
- Create: `apps/backend/src/ragflow/ragflow.client.ts`
- Test: `apps/backend/src/ragflow/ragflow.client.spec.ts`

- [ ] **Step 1: Write failing tests for disabled health, live health, failure classification, and chunk mapping**

Tests should inject a fake fetch function. Do not call the real RAGFlow service from unit tests.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pas-backend test -- ragflow.client.spec.ts`

Expected: fail because `RagflowClient` does not exist.

- [ ] **Step 3: Implement the minimal client**

Implement:
- `checkHealth()` returns `disabled` without network calls when `RAGFLOW_CLIENT_MODE=disabled`.
- `checkHealth()` calls `GET {baseUrl}/api/v1/datasets` in real mode and returns `ok` for HTTP 2xx.
- Non-2xx and fetch errors return classified failure objects.
- `retrieveKnowledgeChunks()` maps common RAGFlow response shapes into `KnowledgeChunk[]`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter pas-backend test -- ragflow.client.spec.ts`

Expected: pass.

### Task 3: Backend Module And API Endpoints

**Files:**
- Create: `apps/backend/src/ragflow/ragflow.module.ts`
- Create: `apps/backend/src/ragflow/ragflow.controller.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/ragflow/ragflow.controller.spec.ts`

- [ ] **Step 1: Write failing controller tests**

Test that:
- `GET /api/ragflow/health` delegates to `RagflowClient.checkHealth()`.
- Search rejects missing query before calling RAGFlow.
- Search delegates to `RagflowClient.retrieveKnowledgeChunks()` with `PAS_KB_ID`.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pas-backend test -- ragflow.controller.spec.ts`

Expected: fail because controller/module do not exist.

- [ ] **Step 3: Implement controller/module**

Expose:
- `GET /api/ragflow/health`
- `POST /api/ragflow/search`

Keep frontend and future Feishu Bot indirect: both call PAS backend, never RAGFlow directly.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter pas-backend test -- ragflow.controller.spec.ts`

Expected: pass.

### Task 4: Cold-Start And Regression Report Docs

**Files:**
- Create: `docs/ragflow/v0-dataset-cold-start.md`
- Create: `docs/ragflow/50-question-regression-template.md`
- Modify: `README.md`

- [ ] **Step 1: Document blocked inputs and non-secret runtime fields**

The docs must state:
- Old `IP-Guard-Gate` KB is not the V0 all-user dataset.
- New dataset ID must stay in local runtime environment and out of Git.
- Required inputs are the 30-50 curated materials list and 50 real questions.
- Regression report columns include question, expected answer intent, hit chunks, citations, failure reason, and human review result.

- [ ] **Step 2: Verify docs do not leak protected paths or secrets**

Run:
`git check-ignore -v -- external/ragflow/docker/.env backups/ragflow/ragflow_mysql_data.tar.gz .env .env.prod local.key .env.example`

Expected: protected files are ignored; `.env.example` is not ignored.

### Task 5: Final Verification And PR

**Files:**
- All touched files.

- [ ] **Step 1: Run backend-focused verification**

Run:
`pnpm --filter pas-backend test`
`pnpm --filter pas-backend typecheck`

- [ ] **Step 2: Run repo verification**

Run:
`pnpm lint`
`pnpm typecheck`
`pnpm test`
`pnpm build`
`pnpm compose:config`
`git diff --check`

- [ ] **Step 3: Commit and open Draft PR**

Commit message:
`feat: add ragflow backend adapter`

Open PR against `main`, reference `#2`, and explicitly list remaining blocked inputs.

---

## Self-Review

- Spec coverage: adapter, config, health check, error classification, `KnowledgeChunk` mapping, cold-start docs, and 50-question report format are covered. Real dataset import remains blocked by missing user inputs from issue #2.
- Placeholder scan: no `TBD`, `TODO`, or undefined implementation hand-waves remain in the executable task list.
- Type consistency: `KnowledgeChunk`, `RagflowClient`, `RagflowController`, and config field names match across tasks.
