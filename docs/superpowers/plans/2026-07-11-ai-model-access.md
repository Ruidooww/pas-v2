# AI Model Access Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an administrator-only `AI 模型接入` page that securely manages the PAS generation model, exposes read-only RAGFlow model and dataset state, and applies the active PAS model to QA, customer-analysis narratives, and proposal section bodies without weakening PAS-owned ACL, citation, trace, or review controls.

**Architecture:** A new NestJS `ai-model` module owns provider presets, endpoint policy, AES-256-GCM secret handling, the singleton PostgreSQL configuration, an immutable effective runtime snapshot, connection tests, and administrator APIs. The existing `LlmClient` reads that runtime snapshot for every call and uses one OpenAI-compatible transport. Feature-specific providers decide whether model output is valid and fall back to the current deterministic implementation. The React page is lazy-loaded through the existing secondary-menu system and keeps PAS generation configuration separate from read-only RAGFlow state.

**Tech Stack:** NestJS 11, TypeScript 6, Prisma 6/PostgreSQL, Node.js `crypto` and `fetch`, Vitest 4, React 19, Ant Design 6, Docker Compose.

## Global Constraints

- The approved design is `docs/superpowers/specs/2026-07-11-ai-model-access-design.md`; implementation must not weaken it.
- PAS generation configuration is editable; RAGFlow model and dataset state is refresh-only.
- Supported PAS providers are `bailian`, `deepseek`, `openai`, and `custom`, all through OpenAI-compatible `/chat/completions`; do not add vendor SDKs.
- Database configuration takes precedence over environment configuration. Environment configuration takes precedence over mock/rule-based behavior.
- An enabled database row that cannot be decrypted fails closed to deterministic generation. It must not silently use the environment key.
- A failed candidate test must not change the persisted row or effective runtime snapshot.
- The first database save requires an explicitly submitted API key. A blank key may preserve an existing database key but must never copy an environment key into PostgreSQL.
- API keys, ciphertext, IVs, authentication tags, prompts, retrieved chunks, customer payloads, and full model outputs must not appear in API responses, audit metadata, errors, or logs.
- Model URLs must pass exact-host policy on connection test and runtime use. Redirects are disabled.
- Model-management writes require HTTPS, except loopback HTTP used for local development/precheck.
- QA citations, proposal traces/citations/assumptions/section IDs, and `reviewRequired=true` remain PAS-owned.
- Keep `design-qa.md` untracked and untouched.
- Do not modify real RAGFlow data or its Docker volumes.
- Follow RED-GREEN-REFACTOR. Stage and commit only files listed for the current task.
- A real cloud-provider activation and the 50/100-question human-review gate require an administrator-supplied key and are operational rollout work, not a reason to weaken automated tests.

---

## File Map

**Create:**

- `apps/backend/src/ai-model/ai-model.types.ts`
- `apps/backend/src/ai-model/ai-model.errors.ts`
- `apps/backend/src/ai-model/ai-model.crypto.ts`
- `apps/backend/src/ai-model/ai-model.crypto.spec.ts`
- `apps/backend/src/ai-model/ai-model.endpoint-policy.ts`
- `apps/backend/src/ai-model/ai-model.endpoint-policy.spec.ts`
- `apps/backend/src/ai-model/openai-compatible.transport.ts`
- `apps/backend/src/ai-model/openai-compatible.transport.spec.ts`
- `apps/backend/src/ai-model/ai-model-configuration.service.ts`
- `apps/backend/src/ai-model/ai-model-configuration.service.spec.ts`
- `apps/backend/src/ai-model/ai-model-management.service.ts`
- `apps/backend/src/ai-model/ai-model-management.service.spec.ts`
- `apps/backend/src/ai-model/ai-model.controller.ts`
- `apps/backend/src/ai-model/ai-model.controller.spec.ts`
- `apps/backend/src/ai-model/ai-model.tokens.ts`
- `apps/backend/src/ai-model/ai-model.module.ts`
- `apps/backend/src/qa/model-qa-draft.provider.ts`
- `apps/backend/src/qa/model-qa-draft.provider.spec.ts`
- `apps/backend/src/proposal/model-proposal-draft.provider.ts`
- `apps/backend/src/proposal/model-proposal-draft.provider.spec.ts`
- `apps/backend/src/llm/llm-generation-audit.ts`
- `apps/backend/prisma/migrations/20260711000000_ai_model_configuration/migration.sql`
- `apps/frontend/src/pages/AiModelAccessPage.tsx`
- `apps/frontend/src/pages/AiModelAccessPage.test.tsx`

**Modify:**

- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/persistence/persistence-sink.ts`
- `apps/backend/src/persistence/persistence-sink.spec.ts`
- `apps/backend/src/audit/audit.types.ts`
- `apps/backend/src/audit/audit-log.service.spec.ts`
- `apps/backend/src/llm/llm.client.ts`
- `apps/backend/src/llm/llm.client.spec.ts`
- `apps/backend/src/llm/llm.config.ts`
- `apps/backend/src/llm/llm.errors.ts`
- `apps/backend/src/llm/llm.module.ts`
- `apps/backend/src/llm/llm.tokens.ts`
- `apps/backend/src/llm/llm.types.ts`
- `apps/backend/src/ragflow/ragflow.client.ts`
- `apps/backend/src/ragflow/ragflow.client.spec.ts`
- `apps/backend/src/qa/qa.types.ts`
- `apps/backend/src/qa/qa.service.ts`
- `apps/backend/src/qa/qa.service.spec.ts`
- `apps/backend/src/qa/qa.module.ts`
- `apps/backend/src/customer-analysis/customer-analysis.service.ts`
- `apps/backend/src/customer-analysis/customer-analysis.module.ts`
- `apps/backend/src/customer-analysis/customer-analysis.narrative.spec.ts`
- `apps/backend/src/proposal/proposal.module.ts`
- `apps/backend/src/proposal/proposal.service.spec.ts`
- `apps/backend/src/menu/menu-defaults.ts`
- `apps/backend/src/menu/menu.service.ts`
- `apps/backend/src/menu/menu.service.spec.ts`
- `apps/backend/src/menu/menu.types.ts`
- `apps/backend/src/throttle.config.ts`
- `apps/backend/src/throttle.config.spec.ts`
- `apps/frontend/src/api.ts`
- `apps/frontend/src/api.test.ts`
- `apps/frontend/src/types.ts`
- `apps/frontend/src/navigation.tsx`
- `apps/frontend/src/lazy-pages.tsx`
- `apps/frontend/src/lazy-pages.test.tsx`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/App.test.tsx`
- `apps/frontend/src/App.code-splitting.test.tsx`
- `apps/frontend/src/pages/MenuConfigPage.tsx`
- `apps/frontend/src/pages/MenuConfigPage.test.tsx`
- `apps/frontend/src/pages/SystemPages.test.tsx`
- `apps/frontend/src/styles.css`
- `apps/frontend/nginx.conf`
- `.env.example`
- `docker-compose.yml`
- `scripts/verify-compose.mjs`
- `scripts/smoke-local-menu.mjs`
- `scripts/smoke-local-menu.test.mjs`
- `docs/deployment/v1-sop.md`

Do not create a second Prisma client, a generic provider plugin framework, a separate secrets service, or a RAGFlow mutation endpoint. Add a file outside this map only when a failing test proves the file boundary is incomplete; document the reason before editing it.

---

### Task 1: Secure Singleton Persistence And Endpoint Policy

**Files:**
- Create: `apps/backend/src/ai-model/ai-model.types.ts`
- Create: `apps/backend/src/ai-model/ai-model.errors.ts`
- Create: `apps/backend/src/ai-model/ai-model.crypto.ts`
- Create: `apps/backend/src/ai-model/ai-model.crypto.spec.ts`
- Create: `apps/backend/src/ai-model/ai-model.endpoint-policy.ts`
- Create: `apps/backend/src/ai-model/ai-model.endpoint-policy.spec.ts`
- Create: `apps/backend/prisma/migrations/20260711000000_ai_model_configuration/migration.sql`
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/src/persistence/persistence-sink.ts`
- Modify: `apps/backend/src/persistence/persistence-sink.spec.ts`

**Contracts:**

```typescript
export type AiModelProvider = "bailian" | "deepseek" | "openai" | "custom";
export type ModelTestStatus = "passed" | "failed";

export type PersistedAiModelConfiguration = {
  id: "generation-default";
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  encryptedApiKey: string;
  apiKeyIv: string;
  apiKeyAuthTag: string;
  timeoutMs: number;
  enabled: boolean;
  lastTestStatus: ModelTestStatus;
  lastTestedAt: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EncryptedSecret = Pick<
  PersistedAiModelConfiguration,
  "encryptedApiKey" | "apiKeyIv" | "apiKeyAuthTag"
>;
```

Provider presets are exactly:

```typescript
export const MODEL_PROVIDER_PRESETS = {
  bailian: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
  custom: ""
} as const;
```

- [ ] **Step 1: Write failing encryption, URL-policy, schema, and persistence tests**

Cover a 32-byte base64 master key, random IVs, round trip, wrong key, tampered ciphertext/tag, missing/invalid key, preset hosts, exact custom `host` and `host:port`, wildcard rejection, credentials/query/fragment rejection, HTTP restrictions, timeout bounds `5_000..120_000`, and the singleton persistence mapping.

Add a persistence test that proves encrypted fields round-trip but plaintext never enters the stored record.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/ai-model/ai-model.crypto.spec.ts src/ai-model/ai-model.endpoint-policy.spec.ts src/persistence/persistence-sink.spec.ts
```

Expected: FAIL because the `ai-model` contracts and persistence methods do not exist.

- [ ] **Step 3: Implement minimal crypto and policy**

Use `createCipheriv("aes-256-gcm", key, randomBytes(12))`, store all binary values as base64, and verify the decoded key length before encrypt/decrypt. Throw `MODEL_CONFIG_ENCRYPTION_UNAVAILABLE` without embedding secret material.

Normalize with `new URL()`, strip only trailing slashes, and reject username, password, `search`, and `hash`. Compare `url.host.toLowerCase()` against exact lower-cased allowlist entries. A preset provider may use its canonical host; any edited host must be in `MODEL_ENDPOINT_ALLOWLIST`. Only provider `custom` may use allowlisted `http:`.

- [ ] **Step 4: Add the Prisma model and awaited persistence methods**

Use this Prisma shape:

```prisma
model AiModelConfiguration {
  id                String   @id
  provider          String
  baseUrl           String   @map("base_url")
  model             String
  encryptedApiKey   String   @map("encrypted_api_key")
  apiKeyIv          String   @map("api_key_iv")
  apiKeyAuthTag     String   @map("api_key_auth_tag")
  timeoutMs         Int      @map("timeout_ms")
  enabled           Boolean  @default(true)
  lastTestStatus    String   @map("last_test_status")
  lastTestedAt      DateTime @map("last_tested_at")
  updatedBy         String   @map("updated_by")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("ai_model_configurations")
}
```

Add awaited methods, not mirror-queue methods:

```typescript
loadAiModelConfiguration(): Promise<PersistedAiModelConfiguration | undefined>;
saveAiModelConfiguration(value: PersistedAiModelConfiguration): Promise<void>;
```

`saveAiModelConfiguration` must reject when PostgreSQL persistence is disabled; saving secrets to an in-memory fallback is not acceptable.

- [ ] **Step 5: Generate Prisma and verify GREEN**

```powershell
pnpm --filter pas-backend prisma:generate
pnpm --filter pas-backend exec prisma validate --schema prisma/schema.prisma
pnpm --filter pas-backend exec vitest run src/ai-model/ai-model.crypto.spec.ts src/ai-model/ai-model.endpoint-policy.spec.ts src/persistence/persistence-sink.spec.ts
```

Expected: Prisma validation succeeds and focused tests pass.

- [ ] **Step 6: Commit the persistence boundary**

```powershell
git add apps/backend/src/ai-model/ai-model.types.ts apps/backend/src/ai-model/ai-model.errors.ts apps/backend/src/ai-model/ai-model.crypto.ts apps/backend/src/ai-model/ai-model.crypto.spec.ts apps/backend/src/ai-model/ai-model.endpoint-policy.ts apps/backend/src/ai-model/ai-model.endpoint-policy.spec.ts apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/20260711000000_ai_model_configuration/migration.sql apps/backend/src/persistence/persistence-sink.ts apps/backend/src/persistence/persistence-sink.spec.ts
git commit -m "feat: secure persisted AI model configuration"
```

---

### Task 2: Dynamic Runtime And OpenAI-Compatible Transport

**Files:**
- Create: `apps/backend/src/ai-model/openai-compatible.transport.ts`
- Create: `apps/backend/src/ai-model/openai-compatible.transport.spec.ts`
- Create: `apps/backend/src/ai-model/ai-model-configuration.service.ts`
- Create: `apps/backend/src/ai-model/ai-model-configuration.service.spec.ts`
- Create: `apps/backend/src/ai-model/ai-model.tokens.ts`
- Create: `apps/backend/src/ai-model/ai-model.module.ts`
- Modify: `apps/backend/src/llm/llm.client.ts`
- Modify: `apps/backend/src/llm/llm.client.spec.ts`
- Modify: `apps/backend/src/llm/llm.config.ts`
- Modify: `apps/backend/src/llm/llm.errors.ts`
- Modify: `apps/backend/src/llm/llm.module.ts`
- Modify: `apps/backend/src/llm/llm.tokens.ts`
- Modify: `apps/backend/src/llm/llm.types.ts`

**Runtime contract:**

```typescript
export type EffectiveAiModelSnapshot = Readonly<{
  status: "running" | "not_configured" | "error";
  source: "database" | "environment" | "mock";
  provider?: AiModelProvider;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  timeoutMs: number;
  errorCode?: "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE" | "MODEL_ENDPOINT_NOT_ALLOWED";
}>;

export type AiModelRuntimePort = {
  getSnapshot(): EffectiveAiModelSnapshot;
};
```

The configuration service owns one frozen snapshot and replaces the object reference only after a successful persisted update. It hydrates the singleton before the provider factory resolves.

- [ ] **Step 1: Write failing precedence, fail-closed, hot-reload, transport, and error-mapping tests**

Cover:

- enabled/decryptable DB row over environment;
- disabled DB row falling back to environment;
- no usable key falling back to mock;
- enabled/undecryptable DB row producing `source=database`, `status=error`, and no environment secret;
- snapshot replacement affecting the next `LlmClient.complete()` without restart;
- revalidation of endpoint policy on every runtime call;
- `redirect: "error"`, timeout abort, non-empty assistant content, and no response-body proxying;
- HTTP 401/403, 404, 429, 5xx, timeout, empty response, and endpoint-policy categories.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/ai-model/ai-model-configuration.service.spec.ts src/ai-model/openai-compatible.transport.spec.ts src/llm/llm.client.spec.ts
```

Expected: FAIL because runtime and transport providers do not exist.

- [ ] **Step 3: Implement the shared transport**

The transport accepts an already selected real snapshot plus `LlmCompleteRequest`, validates endpoint policy immediately before fetch, and calls:

```typescript
await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  redirect: "error",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  signal: AbortSignal.timeout(timeoutMs)
});
```

Map failures to stable codes and return only `{ content, model }`. Never include provider response bodies in thrown messages.

- [ ] **Step 4: Implement runtime hydration and atomic replacement**

Infer the environment provider from the canonical host, otherwise use `custom`. Validate environment URLs through the same endpoint policy. Preserve the existing `LLM_CLIENT_MODE=mock` behavior.

Expose only these mutation methods to the management service:

```typescript
getPersistedConfiguration(): PersistedAiModelConfiguration | undefined;
getSnapshot(): EffectiveAiModelSnapshot;
activatePersistedConfiguration(record: PersistedAiModelConfiguration, plaintextApiKey: string): Promise<void>;
disablePersistedConfiguration(actorUserId: string): Promise<void>;
```

Persist first, then replace the runtime snapshot. If persistence throws, retain the previous snapshot.

- [ ] **Step 5: Wire the base AI-model module and refactor `LlmClient`**

Create the base `AiModelModule` with `PersistenceModule`, the async hydrated configuration service, and the shared transport; export both AI-model tokens. `LlmModule` imports it and constructs `LlmClient` from those tokens. `LlmClient` delegates real calls to the transport. For `mock` or `error` snapshots it returns `mode: "mock"` so existing feature fallbacks remain in control. Add `provider` and `source` to `LlmCompletion` without returning secrets.

- [ ] **Step 6: Verify GREEN and type safety**

```powershell
pnpm --filter pas-backend exec vitest run src/ai-model/ai-model-configuration.service.spec.ts src/ai-model/openai-compatible.transport.spec.ts src/llm/llm.client.spec.ts
pnpm --filter pas-backend typecheck
```

Expected: focused tests and backend typecheck pass.

- [ ] **Step 7: Commit the runtime**

```powershell
git add docs/superpowers/plans/2026-07-11-ai-model-access.md apps/backend/src/ai-model/openai-compatible.transport.ts apps/backend/src/ai-model/openai-compatible.transport.spec.ts apps/backend/src/ai-model/ai-model-configuration.service.ts apps/backend/src/ai-model/ai-model-configuration.service.spec.ts apps/backend/src/ai-model/ai-model.tokens.ts apps/backend/src/ai-model/ai-model.module.ts apps/backend/src/llm/llm.client.ts apps/backend/src/llm/llm.client.spec.ts apps/backend/src/llm/llm.config.ts apps/backend/src/llm/llm.errors.ts apps/backend/src/llm/llm.module.ts apps/backend/src/llm/llm.tokens.ts apps/backend/src/llm/llm.types.ts
git commit -m "feat: add dynamic AI model runtime"
```

---

### Task 3: Administrator APIs, Audit Metadata, And RAGFlow Read Model

**Files:**
- Create: `apps/backend/src/ai-model/ai-model-management.service.ts`
- Create: `apps/backend/src/ai-model/ai-model-management.service.spec.ts`
- Create: `apps/backend/src/ai-model/ai-model.controller.ts`
- Create: `apps/backend/src/ai-model/ai-model.controller.spec.ts`
- Modify: `apps/backend/src/ai-model/ai-model.module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/audit/audit.types.ts`
- Create: `apps/backend/src/audit/audit-log.service.spec.ts`
- Modify: `apps/backend/src/ragflow/ragflow.client.ts`
- Modify: `apps/backend/src/ragflow/ragflow.client.spec.ts`
- Modify: `apps/backend/src/throttle.config.ts`
- Modify: `apps/backend/src/throttle.config.spec.ts`

**API contracts:**

```typescript
export type AiModelCandidateRequest = {
  provider: AiModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutSeconds: number;
};

export type AiModelTestResult = {
  ok: boolean;
  provider: AiModelProvider;
  model: string;
  elapsedMs: number;
  errorCode?: ModelErrorCode;
};
```

`GET /overview` returns provider presets plus the non-secret generation overview. `GET /ragflow` returns:

```typescript
{
  status: "ok" | "error" | "disabled";
  baseUrl: string;
  dataset?: {
    datasetId: string;
    name?: string;
    embeddingModel?: string;
    rerankerModel?: string;
    chatModel?: string;
    language?: string;
    chunkMethod?: string;
    documentCount?: number;
    chunkCount?: number;
  };
  unavailableFields: string[];
  errorKind?: string;
  refreshedAt: string;
}
```

- [ ] **Step 1: Write failing management, role, HTTPS, audit, throttle, and RAGFlow parser tests**

Test all five routes. Sales and technical receive 403. Production/LAN HTTP writes receive 403; HTTPS and loopback HTTP pass. `POST generation/test` uses `THROTTLE_MODEL_TEST_LIMIT_PER_MINUTE` default `5`.

Test key rules: blank test key may use an existing DB key or currently effective environment key; first save with blank key fails; blank save with an existing disabled/enabled DB row preserves that DB key; a new key replaces it; failed save test changes neither row nor snapshot. A standalone failed `POST generation/test` is audited but never overwrites the saved row's last successful test metadata.

Assert serialized overview, test response, exceptions, and audit events do not contain plaintext or encrypted key material.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/ai-model/ai-model-management.service.spec.ts src/ai-model/ai-model.controller.spec.ts src/ragflow/ragflow.client.spec.ts src/audit/audit-log.service.spec.ts src/throttle.config.spec.ts
```

Expected: FAIL because management APIs and metadata contracts do not exist.

- [ ] **Step 3: Add non-secret audit metadata**

Extend `AuditAction` with `ai_model_configuration` and `llm_generation`. Add:

```typescript
metadata?: Record<string, string | number | boolean | null>;
```

Configuration events use operations `test`, `save`, `disable`, and `hydrate`. Metadata is limited to provider, model, elapsed milliseconds, test result, and non-secret error code.

- [ ] **Step 4: Implement connection test, save, disable, and sanitized overview**

Connection test sends a non-streaming request with `temperature: 0`, `maxTokens: 8`, and a minimal prompt. `PUT` calls the same private test path again and only persists after success. `DELETE` sets the existing row to `enabled=false`, retains encrypted fields, and recomputes environment/mock runtime state.

Throw structured Nest errors with a stable `code`; do not pass raw provider messages to the controller.

- [ ] **Step 5: Add tolerant read-only RAGFlow dataset parsing**

Add `RagflowClient.getDatasetOverview(datasetId)`. Select the active QA dataset (`QA_KB_ID`, then `PAS_KB_ID`) and tolerate documented/observed variants such as `embd_id`, `rerank_id`, `llm_id`, `parser_id`, `language`, `document_count`/`doc_num`, and `chunk_count`/`chunk_num`. Missing optional values populate `unavailableFields`; only connection/business errors set top-level `status=error`.

- [ ] **Step 6: Wire the module and verify GREEN**

`AiModelModule` imports `PersistenceModule`, `AuditModule`, and `RagflowModule`; it exports runtime and transport tokens for `LlmModule`. Add it to `AppModule`.

```powershell
pnpm --filter pas-backend exec vitest run src/ai-model src/ragflow/ragflow.client.spec.ts src/audit/audit-log.service.spec.ts src/throttle.config.spec.ts
pnpm --filter pas-backend typecheck
```

Expected: focused tests and backend typecheck pass.

- [ ] **Step 7: Commit the administrator boundary**

```powershell
git add apps/backend/src/ai-model/ai-model-management.service.ts apps/backend/src/ai-model/ai-model-management.service.spec.ts apps/backend/src/ai-model/ai-model.controller.ts apps/backend/src/ai-model/ai-model.controller.spec.ts apps/backend/src/ai-model/ai-model.module.ts apps/backend/src/app.module.ts apps/backend/src/audit/audit.types.ts apps/backend/src/audit/audit-log.service.spec.ts apps/backend/src/ragflow/ragflow.client.ts apps/backend/src/ragflow/ragflow.client.spec.ts apps/backend/src/throttle.config.ts apps/backend/src/throttle.config.spec.ts
git commit -m "feat: expose AI model management APIs"
```

---

### Task 4: Apply The Model To QA, Customer Analysis, And Proposals

**Files:**
- Create: `apps/backend/src/qa/model-qa-draft.provider.ts`
- Create: `apps/backend/src/qa/model-qa-draft.provider.spec.ts`
- Create: `apps/backend/src/proposal/model-proposal-draft.provider.ts`
- Create: `apps/backend/src/proposal/model-proposal-draft.provider.spec.ts`
- Create: `apps/backend/src/llm/llm-generation-audit.ts`
- Modify: `apps/backend/src/qa/qa.types.ts`
- Modify: `apps/backend/src/qa/qa.service.ts`
- Modify: `apps/backend/src/qa/qa.service.spec.ts`
- Modify: `apps/backend/src/qa/qa.module.ts`
- Modify: `apps/backend/src/customer-analysis/customer-analysis.service.ts`
- Modify: `apps/backend/src/customer-analysis/customer-analysis.module.ts`
- Modify: `apps/backend/src/customer-analysis/customer-analysis.narrative.spec.ts`
- Modify: `apps/backend/src/proposal/proposal.module.ts`
- Modify: `apps/backend/src/proposal/proposal.service.spec.ts`

**Feature rules:**

- QA sends only `query`, actor ID, and already-authorized chunk IDs/document IDs/content. The model returns answer text only. `QaService` builds citations from the original chunks after generation.
- Customer analysis keeps current evidence selection and rule-based fallback. Pass `feature="customer_analysis"` and actor ID into the generic audit event.
- Proposal first obtains the complete deterministic draft. The model receives only known `sectionId`, title, and current body, and must return JSON `{ sections: [{ sectionId, body }] }`. PAS copies accepted bodies onto the deterministic draft and preserves every other field.

- [ ] **Step 1: Write failing feature-provider tests**

QA tests prove prompt-injection text inside chunks is treated as data, unauthorized chunks never enter the prompt, citations remain unchanged, and mock/error/empty output uses `LocalQaDraftProvider` with the human-review marker.

Proposal tests accept exactly one nonblank body per known section and reject malformed JSON, unknown/duplicate/missing IDs, blank bodies, and bodies above the server limit. Every rejection returns the exact deterministic draft structure.

Customer-analysis tests prove real output is used and mock/auth/rate-limit/timeout/invalid responses retain the rule summary.

All three features assert one sanitized `llm_generation` audit event with `feature`, provider/model when available, elapsed time, result, and `fallbackUsed`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/qa/model-qa-draft.provider.spec.ts src/qa/qa.service.spec.ts src/customer-analysis/customer-analysis.narrative.spec.ts src/proposal/model-proposal-draft.provider.spec.ts src/proposal/proposal.service.spec.ts
```

Expected: FAIL because QA and proposal model providers do not exist and customer analysis lacks generic generation audit metadata.

- [ ] **Step 3: Implement the QA provider and module wiring**

Extend `QaDraftInput` with `actorUserId`. Build chunk input as JSON data, cap the number/length using the already selected `topK` result, and use a system instruction that knowledge content is untrusted data. On any non-real completion or exception, call the existing local provider.

Import `LlmModule` and `AuditModule` in `QaModule`; do not move ACL filtering out of `QaService`.

- [ ] **Step 4: Reuse the runtime in customer analysis**

Keep `buildNarrative`'s catch-and-fallback behavior. Add actor ID to its call boundary and emit only sanitized generic audit metadata after the final decision.

- [ ] **Step 5: Implement proposal body replacement**

Call `LocalProposalDraftProvider` first. Parse and validate model JSON before producing a new draft:

```typescript
return {
  ...deterministic,
  sections: deterministic.sections.map((section) => ({
    ...section,
    body: bodiesBySectionId.get(section.sectionId)!
  }))
};
```

Never let model data supply section IDs, titles, traces, citations, assumptions, IDs, timestamps, customer metadata, or review flags. Any whole-response validation failure returns `deterministic`.

- [ ] **Step 6: Verify GREEN and regression behavior**

```powershell
pnpm --filter pas-backend exec vitest run src/qa src/customer-analysis src/proposal src/llm
pnpm --filter pas-backend typecheck
```

Expected: all focused suites pass; existing deterministic paths remain green.

- [ ] **Step 7: Commit feature integration**

```powershell
git add docs/superpowers/plans/2026-07-11-ai-model-access.md apps/backend/src/llm/llm-generation-audit.ts apps/backend/src/qa/model-qa-draft.provider.ts apps/backend/src/qa/model-qa-draft.provider.spec.ts apps/backend/src/qa/qa.types.ts apps/backend/src/qa/qa.service.ts apps/backend/src/qa/qa.service.spec.ts apps/backend/src/qa/qa.module.ts apps/backend/src/customer-analysis/customer-analysis.service.ts apps/backend/src/customer-analysis/customer-analysis.module.ts apps/backend/src/customer-analysis/customer-analysis.narrative.spec.ts apps/backend/src/proposal/model-proposal-draft.provider.ts apps/backend/src/proposal/model-proposal-draft.provider.spec.ts apps/backend/src/proposal/proposal.module.ts apps/backend/src/proposal/proposal.service.spec.ts
git commit -m "feat: use configured model for generated content"
```

---

### Task 5: Protect The Secondary Menu Contract

**Files:**
- Modify: `apps/backend/src/menu/menu-defaults.ts`
- Modify: `apps/backend/src/menu/menu.service.ts`
- Modify: `apps/backend/src/menu/menu.service.spec.ts`
- Modify: `apps/backend/src/menu/menu.types.ts`
- Modify: `apps/frontend/src/types.ts`
- Modify: `apps/frontend/src/navigation.tsx`
- Modify: `apps/frontend/src/pages/MenuConfigPage.tsx`
- Modify: `apps/frontend/src/pages/MenuConfigPage.test.tsx`
- Modify: `apps/frontend/src/App.test.tsx`

**Menu contract:**

```typescript
{
  key: "ai_model_access",
  label: "AI 模型接入",
  primaryKey: "system_management",
  route: "/system/ai-models",
  roles: ["admin"],
  enabled: true,
  order: 60
}
```

Move `platform_governance` to order `70`.

- [ ] **Step 1: Write failing backend and frontend menu tests**

Prove admin visibility, sales/technical absence, expected ordering, and that an override cannot broaden `ai_model_access.roles`. Also seed a hostile persisted override and prove effective menu calculation clamps it to admin-only.

- [ ] **Step 2: Run tests and verify RED**

```powershell
pnpm --filter pas-backend exec vitest run src/menu/menu.service.spec.ts
pnpm --filter pas-frontend exec vitest run src/pages/MenuConfigPage.test.tsx src/App.test.tsx
```

Expected: FAIL because `ai_model_access` is unknown.

- [ ] **Step 3: Implement protected menu behavior**

Add the key to backend/frontend unions and defaults. In backend override validation, reject any supplied role set other than exactly `admin`; in effective merge, force the protected key back to `roles: ["admin"]` to defend against legacy/manual persisted state. Keep enable/order customization available to admins.

In `MenuConfigPage`, display the admin role as locked for this item so the UI does not invite a request the backend must reject.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
pnpm --filter pas-backend exec vitest run src/menu/menu.service.spec.ts
pnpm --filter pas-frontend exec vitest run src/pages/MenuConfigPage.test.tsx src/App.test.tsx
pnpm --filter pas-frontend typecheck
git add apps/backend/src/menu/menu-defaults.ts apps/backend/src/menu/menu.service.ts apps/backend/src/menu/menu.service.spec.ts apps/backend/src/menu/menu.types.ts apps/frontend/src/types.ts apps/frontend/src/navigation.tsx apps/frontend/src/pages/MenuConfigPage.tsx apps/frontend/src/pages/MenuConfigPage.test.tsx apps/frontend/src/App.test.tsx
git commit -m "feat: add protected AI model menu"
```

---

### Task 6: Build The Lazy AI Model Access Page

**Files:**
- Create: `apps/frontend/src/pages/AiModelAccessPage.tsx`
- Create: `apps/frontend/src/pages/AiModelAccessPage.test.tsx`
- Modify: `apps/frontend/src/api.ts`
- Modify: `apps/frontend/src/api.test.ts`
- Modify: `apps/frontend/src/types.ts`
- Modify: `apps/frontend/src/navigation.tsx`
- Modify: `apps/frontend/src/lazy-pages.tsx`
- Modify: `apps/frontend/src/lazy-pages.test.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/App.code-splitting.test.tsx`
- Modify: `apps/frontend/src/pages/SystemPages.test.tsx`
- Modify: `apps/frontend/src/styles.css`

**UI structure:**

- One unframed page header with status/source summary.
- One `Tabs` control: `PAS 生成模型` and `RAGFlow 模型状态`.
- The editable tab uses one form surface, not cards nested inside cards.
- Provider `Select`, model/base URL/API-key `Input`, timeout `InputNumber`, and icon-backed test/save/disable buttons with tooltips where needed.
- The read-only tab uses `Descriptions` and a refresh icon button.

- [ ] **Step 1: Write failing API and page tests**

Extend `api()` to support `PUT` and `DELETE` and preserve structured backend error `code` on `ApiError`.

Page tests cover initial overview, provider base-URL presets, custom URL requirement, timeout range, existing-key text without key value, omission of blank `apiKey`, clearing a submitted key after successful save, confirmation before disable, independent loading states, stale overview/RAGFlow request suppression, error-code-to-Chinese-message mapping, and read-only RAGFlow fields. A failed unsaved candidate test must remain visible as transient page state without replacing the active configuration's saved test status/time.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm --filter pas-frontend exec vitest run src/api.test.ts src/pages/AiModelAccessPage.test.tsx src/lazy-pages.test.tsx src/App.code-splitting.test.tsx src/pages/SystemPages.test.tsx
```

Expected: FAIL because the page, route, and API methods do not exist.

- [ ] **Step 3: Implement API types and independent request state**

Use separate booleans for `loadingOverview`, `testing`, `saving`, `disabling`, and `refreshingRagflow`. Use monotonically increasing `useRef` request IDs for overview and RAGFlow reads; only the latest response may update state.

Build save/test payloads with conditional spread:

```typescript
const payload = {
  provider: values.provider,
  baseUrl: values.baseUrl.trim(),
  model: values.model.trim(),
  timeoutSeconds: values.timeoutSeconds,
  ...(values.apiKey?.trim() ? { apiKey: values.apiKey.trim() } : {})
};
```

Never place the key in component overview state, query strings, local storage, or rendered diagnostics.

- [ ] **Step 4: Add lazy route and responsive styles**

Add `aiModelAccess` to the active-view union and map `/system/ai-models`. Export `LazyAiModelAccessPage` from `lazy-pages.tsx`. Use existing Ant Design icons, including `ApiOutlined`, `ExperimentOutlined`, `SaveOutlined`, `PoweroffOutlined`, and `ReloadOutlined` where applicable.

At narrow widths, make form rows one column and command buttons full-width. Long URLs/model IDs use wrapping and must not overlap adjacent labels.

- [ ] **Step 5: Verify GREEN, build, and commit**

```powershell
pnpm --filter pas-frontend exec vitest run src/api.test.ts src/pages/AiModelAccessPage.test.tsx src/lazy-pages.test.tsx src/App.code-splitting.test.tsx src/pages/SystemPages.test.tsx
pnpm --filter pas-frontend typecheck
pnpm --filter pas-frontend build
git add apps/frontend/src/pages/AiModelAccessPage.tsx apps/frontend/src/pages/AiModelAccessPage.test.tsx apps/frontend/src/api.ts apps/frontend/src/api.test.ts apps/frontend/src/types.ts apps/frontend/src/navigation.tsx apps/frontend/src/lazy-pages.tsx apps/frontend/src/lazy-pages.test.tsx apps/frontend/src/App.tsx apps/frontend/src/App.code-splitting.test.tsx apps/frontend/src/pages/SystemPages.test.tsx apps/frontend/src/styles.css
git commit -m "feat: add AI model access page"
```

Expected: focused tests, typecheck, and production build pass.

---

### Task 7: Deployment Configuration, Smoke Coverage, And SOP

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `apps/frontend/nginx.conf`
- Modify: `scripts/verify-compose.mjs`
- Modify: `scripts/smoke-local-menu.mjs`
- Modify: `scripts/smoke-local-menu.test.mjs`
- Modify: `docs/deployment/v1-sop.md`

- [ ] **Step 1: Write failing compose and smoke assertions**

Require backend compose propagation for:

```dotenv
MODEL_CONFIG_ENCRYPTION_KEY=
MODEL_ENDPOINT_ALLOWLIST=
THROTTLE_MODEL_TEST_LIMIT_PER_MINUTE=5
```

Add `ai_model_access` to expected secondary keys, route smoke checks, and an admin `GET /api/internal/ai-models/overview` check that asserts no secret-shaped fields.

Add an Nginx config assertion that preserves an incoming TLS terminator's `X-Forwarded-Proto` value and falls back to `$scheme` only when that header is absent.

- [ ] **Step 2: Run checks and verify RED**

```powershell
pnpm compose:config
pnpm test:smoke
```

Expected: FAIL because compose and smoke contracts are not updated.

- [ ] **Step 3: Update environment and operational documentation**

Document generation of the encryption key:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Document exact allowlist syntax, HTTPS-only writes, migration order, database-over-environment precedence, failed-decryption behavior, master-key rotation risk, test/save/disable flow, RAGFlow read-only verification, rollback by disabling the DB row, and explicit prohibition on committing `.env`.

State that rotating `MODEL_CONFIG_ENCRYPTION_KEY` without re-encrypting the stored API key makes the enabled database configuration unusable and intentionally blocks environment fallback until the row is disabled.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
pnpm compose:config
pnpm test:smoke
git add .env.example docker-compose.yml apps/frontend/nginx.conf scripts/verify-compose.mjs scripts/smoke-local-menu.mjs scripts/smoke-local-menu.test.mjs docs/deployment/v1-sop.md
git commit -m "docs: add AI model deployment controls"
```

---

### Task 8: Full Verification, Browser QA, And Activation Boundary

**Files:**
- Modify only files required to fix failures introduced by Tasks 1-7.

- [ ] **Step 1: Inspect scope before full verification**

```powershell
git status --short
git diff --stat HEAD~7..HEAD
git diff --check HEAD~7..HEAD
```

Expected: only planned files plus untouched `?? design-qa.md`; no whitespace errors.

- [ ] **Step 2: Run repository gates**

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm compose:config
pnpm test:smoke
```

Expected: all commands exit `0`.

- [ ] **Step 3: Rebuild the local stack and apply the migration**

Use the repository's existing compose workflow; do not remove volumes:

```powershell
docker compose up -d --build
docker compose ps
docker compose exec -T pas-backend npx prisma migrate status
```

The backend container runs `npx prisma migrate deploy` before starting the API, so a healthy rebuilt container plus `migrate status` proves the migration was applied. If Docker is not on `PATH`, use `C:\Program Files\Docker\Docker\resources\bin\docker.exe` for the same non-destructive compose commands. Expected: PAS containers are healthy and Prisma reports the database schema is up to date.

- [ ] **Step 4: Run backend-backed smoke**

```powershell
$env:PAS_BASE_URL='http://127.0.0.1:18000'
pnpm smoke:local
```

Expected: every menu key, including `ai_model_access`, reports `ok`; no secret fields are returned.

- [ ] **Step 5: Perform browser QA at desktop and mobile widths**

Open `http://127.0.0.1:18000`, sign in as the local admin, and verify:

- `AI 模型接入` appears between System Settings and Platform Governance.
- Sales and technical sessions do not show the menu.
- PAS form labels, long URLs, buttons, tabs, and status text do not overlap at desktop and 390px widths.
- Blank API-key state never displays a stored value.
- Test/save/disable controls have independent loading behavior.
- RAGFlow fields are read-only and refresh does not alter retrieval configuration.
- The page has no nested card layout and no horizontal overflow.

Capture desktop and mobile screenshots for visual evidence. Do not save a real key during this precheck unless the administrator has supplied one through the approved local/HTTPS flow.

- [ ] **Step 6: Run a deterministic end-to-end failure/fallback check**

With `LLM_CLIENT_MODE=mock`, exercise QA, customer analysis, and proposal generation. Confirm all three complete through current deterministic output, retain citations/traces/review flags, and emit sanitized fallback audit metadata.

- [ ] **Step 7: Record the real-provider activation boundary**

The code task is complete when Steps 1-6 pass. Real-provider rollout remains explicitly pending until an administrator supplies credentials through the UI. At activation time:

1. Configure HTTPS and the exact endpoint allowlist.
2. Test and save the selected provider/model from the admin page.
3. Smoke QA, customer analysis, and proposal generation.
4. Run the existing 50-question set and the 100-question set.
5. Have the named reviewer complete evidence, citation, and answer-quality review.

Do not claim the real-provider or human-review gate passed without those artifacts.

- [ ] **Step 8: Final scope and commit audit**

```powershell
git status --short
git log --oneline -8
```

Expected: planned commits are present; `design-qa.md` remains untracked and untouched; no task changes remain uncommitted.

---

## Plan Self-Review Checklist

- [ ] Every approved endpoint, provider, secret rule, precedence rule, fallback, audit requirement, UI state, deployment control, and acceptance criterion maps to at least one task and one test.
- [ ] No task introduces vendor SDKs, RAGFlow writes, cross-instance cache invalidation, a generic plugin framework, real CRM, or model-owned citations/traces.
- [ ] Database save cannot happen before a successful repeated connection test.
- [ ] First-save and blank-key semantics are unambiguous and tested.
- [ ] Enabled-but-undecryptable database configuration fails closed and is visible as an error.
- [ ] Endpoint policy is enforced both at candidate test and runtime request.
- [ ] Backend authorization is independent from menu visibility.
- [ ] Frontend never receives or retains an API key from the backend.
- [ ] Focused tests precede implementation in every production task.
- [ ] Full automated gates, backend-backed smoke, desktop/mobile QA, and the real-provider activation boundary are explicit.
