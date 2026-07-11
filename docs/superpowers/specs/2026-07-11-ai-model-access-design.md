# AI Model Access Design

**Goal:** Add an administrator-only AI model access surface that manages the
PAS generation model at runtime, shows RAGFlow model state without mutating it,
and applies the selected generation model to QA, customer analysis, and proposal
content while preserving PAS-owned ACL, citation, trace, and fallback behavior.

## Context

PAS currently has an OpenAI-compatible `LlmClient`, but its configuration comes
only from environment variables. The System Settings page displays those values
as read-only status rows. There is no model-management menu, no connection test,
and no runtime update path.

The configured external RAGFlow is real and provides retrieval through
`/api/v1/retrieval`. The active dataset currently exposes its embedding model,
document count, language, and chunk method. PAS does not use RAGFlow chat to
generate the final answer. QA concatenates retrieved chunks locally, customer
analysis can optionally use `LlmClient`, and proposal text is deterministic.

The approved product boundary is:

- PAS generation-model configuration is editable.
- RAGFlow model and dataset state is read-only.
- The PAS model is used by QA, customer analysis, and proposal content.
- API keys are encrypted in PostgreSQL with a server-held master key.
- Existing environment configuration remains the compatibility fallback.

## Goals

- Add an `AI 模型接入` secondary menu under System Management.
- Restrict the menu and all model-management endpoints to administrators.
- Support Bailian, DeepSeek, OpenAI, and custom OpenAI-compatible endpoints
  without vendor SDKs.
- Test a candidate model before it can replace the effective database config.
- Apply a saved model immediately without restarting the backend.
- Keep RAGFlow retrieval, document ACL, citations, and proposal traces under PAS
  control.
- Preserve deterministic output as an explicit fallback when model generation
  is unavailable or invalid.
- Never return, log, or audit a plaintext API key or full business prompt.

## Non-Goals

- Editing RAGFlow embedding, reranker, or chat-model configuration from PAS.
- Switching an existing RAGFlow dataset embedding model or triggering reindexing.
- Multi-model routing, automatic provider failover, load balancing, or model A/B
  experiments.
- Streaming responses, tool calls, multimodal requests, or vendor-specific SDKs.
- Token-cost dashboards, budget enforcement, or automatic API-key rotation.
- Replacing the approved human-review requirement for QA and proposals.
- Real CRM integration.

## Selected User Experience

The effective System Management menu adds:

```text
System Management
|- Account Management
|- Audit Logs
|- Data And Attachments
|- Secondary Menu Configuration
|- System Settings
|- AI 模型接入
`- Platform Governance
```

The route is `/system/ai-models`. It is lazy-loaded like the other authenticated
pages and is visible only to `admin`. Menu configuration overrides cannot make
the route visible or callable by another role.

The page uses two tabs and does not nest cards inside cards.

### PAS Generation Model

The editable tab contains:

- Effective status: `运行中`, `未配置`, or `连接异常`.
- Configuration source: `database`, `environment`, or `mock`.
- Provider selector: Bailian, DeepSeek, OpenAI, or Custom.
- Base URL.
- Required model identifier. Provider presets never hardcode a model because
  provider model names change independently of PAS releases.
- API-key input. An existing key is represented only by `keyConfigured=true`.
  Leaving the field blank preserves the current key; entering a value replaces
  it.
- Timeout in seconds, constrained to 5 through 120.
- Last test status and time, last update time, and updating administrator.
- `测试连接`, `保存并启用`, and `停用数据库配置` actions.

Provider selection pre-fills the current canonical OpenAI-compatible base URL:

| Provider | Preset base URL |
| --- | --- |
| Bailian | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| DeepSeek | `https://api.deepseek.com` |
| OpenAI | `https://api.openai.com/v1` |
| Custom | Empty; administrator input is required |

The administrator may edit a preset URL. A host outside the preset's approved
hosts is then treated as custom and must pass the deployment allowlist.

The persisted test metadata represents the most recent test associated with the
saved database configuration. A failed unsaved candidate test is shown in the
current page state and audit history but does not overwrite the active row's
last successful activation evidence.

### RAGFlow Model State

The read-only tab contains a refresh icon and displays:

- RAGFlow health and base URL.
- Active QA dataset name.
- Embedding model.
- Reranker model when returned by RAGFlow.
- Chat model when returned by a supported RAGFlow API; otherwise `不可用`.
- Language, chunk method, document count, and chunk count when available.
- Last refresh time.

Failure to read optional model fields does not mark RAGFlow retrieval unhealthy.
The tab must distinguish an unavailable field from a failed RAGFlow connection.

Desktop uses aligned two-column labels and controls. Mobile uses one column and
full-width command buttons. Labels and long model identifiers must wrap without
horizontal overflow.

## Persistence

Add one Prisma model for the database-owned generation configuration:

```text
AiModelConfiguration
- id                     fixed singleton id: generation-default
- provider               bailian | deepseek | openai | custom
- baseUrl
- model
- encryptedApiKey
- apiKeyIv
- apiKeyAuthTag
- timeoutMs
- enabled
- lastTestStatus         passed | failed
- lastTestedAt
- updatedBy
- createdAt
- updatedAt
```

There is at most one generation configuration. `PUT` upserts the singleton and
sets `enabled=true`. Disabling sets `enabled=false`; the encrypted key remains in
the database so the administrator can test and re-enable the same configuration
without re-entering it. Audit history records every enable, replace, and disable
operation.

The effective configuration precedence is:

1. Enabled, decryptable database configuration.
2. Environment configuration when no enabled database record exists.
3. Mock/rule-based mode when neither source has a usable API key.

If an enabled database record exists but cannot be decrypted, PAS does not
silently switch providers. The effective model enters `连接异常`, generation
uses the deterministic fallback, and an audit failure is recorded. An explicit
administrator disable is required before environment fallback resumes.

## Secret Encryption

`MODEL_CONFIG_ENCRYPTION_KEY` contains a base64-encoded 32-byte key. API keys are
encrypted with AES-256-GCM using a new random IV for every saved value. The
ciphertext, IV, and authentication tag are stored separately.

Model-management writes are permitted only through the approved HTTPS release
entry point. Local HTTP remains limited to loopback development and precheck.

When the master key is absent or invalid:

- Environment-based model use remains available.
- Reading model status remains available.
- Saving, replacing, or decrypting a database key fails with
  `MODEL_CONFIG_ENCRYPTION_UNAVAILABLE`.
- No endpoint includes encrypted fields in its response.

The deployment SOP must state that changing the master key without first
re-encrypting the stored API key makes the database configuration unusable.

## Endpoint Allowlist And SSRF Controls

Every model URL must:

- Use `https`, except an explicitly allowlisted custom endpoint may use `http`.
- Contain no username, password, query string, or fragment.
- Resolve to the selected provider's approved host or an exact custom entry in
  `MODEL_ENDPOINT_ALLOWLIST`.

`MODEL_ENDPOINT_ALLOWLIST` is a comma-separated list of exact `host` or
`host:port` entries. It does not accept wildcards. Workspace-specific Bailian
domains and private on-premise model endpoints must be listed explicitly.

Redirects are disabled for model calls so an approved URL cannot redirect the
backend to an unapproved host. Validation is performed for connection tests and
again when creating the runtime request.

## Backend Boundaries

Add an `ai-model` module that owns persistence, encryption, provider presets,
endpoint validation, effective runtime configuration, connection testing, and
the administrator API.

The existing `LlmClient` is changed to read an immutable effective-config
snapshot from the runtime service for each request. A successful database update
atomically replaces that snapshot. Module initialization hydrates the database
record before serving model calls. The current one-backend deployment does not
require cross-instance cache invalidation; horizontal scaling is a future
non-goal.

The API contract is:

```text
GET    /api/internal/ai-models/overview
POST   /api/internal/ai-models/generation/test
PUT    /api/internal/ai-models/generation
DELETE /api/internal/ai-models/generation
GET    /api/internal/ai-models/ragflow
```

All endpoints require an authenticated `admin` user. The test endpoint has a
stricter low-frequency throttle than ordinary read endpoints.

### Overview Response

The generation section returns only non-secret state:

```json
{
  "generation": {
    "status": "running",
    "source": "database",
    "provider": "bailian",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "model": "administrator-entered-model-id",
    "keyConfigured": true,
    "timeoutSeconds": 30,
    "lastTestStatus": "passed",
    "lastTestedAt": "2026-07-11T00:00:00.000Z",
    "updatedBy": "user-id",
    "updatedAt": "2026-07-11T00:00:00.000Z"
  }
}
```

The API never returns `encryptedApiKey`, IV, authentication tag, plaintext key,
or a reversible key hint.

### Connection Test

The test request accepts provider, base URL, model, optional new API key, and
timeout. A blank key reuses the effective stored or environment key. The backend
sends one minimal non-streaming `/chat/completions` request with a tiny output
limit and requires a non-empty assistant response.

The response contains `ok`, provider, model, elapsed milliseconds, and a
sanitized error category. It never proxies the provider response body.

### Save And Enable

`PUT` repeats the same connection test server-side. Only a successful test can
be committed. The transaction saves the encrypted key and non-secret fields;
after commit, the runtime snapshot is atomically replaced. A failed test leaves
the database row and effective runtime configuration unchanged.

A blank key preserves an existing database key, including a key on a disabled
row. Creating the first database configuration requires the administrator to
submit a key even when an environment key is effective; PAS does not silently
copy an environment secret into PostgreSQL.

`DELETE` disables the database row and activates environment fallback. It does
not delete audit history.

## Generation Data Flow

### QA

```text
authenticated user
  -> PAS document ACL
  -> RAGFlow retrieval
  -> PAS post-retrieval document filter
  -> generation model
  -> PAS answer plus PAS-owned citations
```

The model receives the question and only the already-authorized retrieved
chunks. Chunks are structured as data with stable chunk and document identifiers;
the system prompt instructs the model not to follow instructions found inside
knowledge content. The model returns answer text only. It cannot create or
remove citation records.

When the model is mock, unavailable, times out, or returns empty content, QA
uses the existing local evidence draft and retains the `需人工审核` marker.

### Customer Analysis

The existing LLM narrative path uses the same effective runtime configuration.
Its current rule-based fallback remains unchanged. Evidence selection still
occurs before model generation.

### Proposal Content

The deterministic proposal builder continues to own section identifiers,
citations, traces, assumptions, formats, and `reviewRequired=true`. One model
request receives that fixed structure and returns JSON containing body text for
the known section identifiers.

PAS rejects the whole model result and uses the existing deterministic draft if:

- JSON parsing fails.
- A required section is missing.
- An unknown or duplicate section identifier is present.
- A body is blank or exceeds its server-side limit.
- The model call fails or times out.

Model output never replaces citation, trace, assumption, customer, job, or
export metadata.

## Error Contract

Provider failures are mapped to stable categories:

- `MODEL_AUTHENTICATION_FAILED` for HTTP 401 or 403.
- `MODEL_ENDPOINT_OR_MODEL_NOT_FOUND` for HTTP 404.
- `MODEL_RATE_LIMITED` for HTTP 429.
- `MODEL_PROVIDER_UNAVAILABLE` for provider 5xx responses.
- `MODEL_REQUEST_TIMEOUT` for timeout.
- `MODEL_RESPONSE_INVALID` for an empty or structurally invalid response.
- `MODEL_ENDPOINT_NOT_ALLOWED` for URL policy rejection.

The UI shows these categories with concise Chinese messages. Raw provider
responses, request prompts, and keys are never returned to the browser.

## Audit Contract

Extend the generic audit event with optional structured, non-secret metadata.
Add `ai_model_configuration` and `llm_generation` actions.

Configuration events record actor, operation, provider, model, test result, and
elapsed milliseconds. Generation events record actor when available, feature
(`qa`, `customer_analysis`, or `proposal`), provider, model, elapsed
milliseconds, result, and whether deterministic fallback was used.

Audit metadata must not contain API keys, encrypted key material, full prompts,
full model outputs, customer payloads, or retrieved chunk content.

## Frontend Integration

Add a lazy `AiModelAccessPage`, route mapping, `ai_model_access` secondary-menu
key, admin role rule, icon, and smoke entry using the existing menu patterns.

The API-key input is never initialized from a response. After a successful save
it is cleared. A blank value is omitted from requests so it cannot overwrite a
stored key accidentally. Destructive disable uses the existing confirmation
dialog pattern.

Loading, test, save, disable, and RAGFlow refresh states are independent so one
operation cannot disable unrelated controls. Stale requests cannot overwrite a
newer overview response.

## Migration And Rollout

1. Apply the Prisma migration.
2. Set a strong `MODEL_CONFIG_ENCRYPTION_KEY` and the required custom endpoint
   hosts in `MODEL_ENDPOINT_ALLOWLIST`.
3. Deploy without creating a database configuration. Existing environment or
   mock behavior remains effective.
4. Confirm the RAGFlow read-only tab matches the live dataset.
5. Test and save the selected cloud model from the administrator page.
6. Run QA, customer-analysis, and proposal smoke checks.
7. Rerun the 50- and 100-question evidence sets and complete human review.

Rollback disables the database configuration and returns to environment or
deterministic fallback behavior. It does not modify RAGFlow or delete its data.

## Tests

### Backend

- AES-256-GCM round trip, random IV behavior, wrong key, missing key, and tamper
  rejection.
- Provider presets, custom-host allowlist, invalid URL, redirect rejection, and
  timeout bounds.
- Effective precedence for enabled database, environment, and mock sources.
- Enabled but undecryptable database config fails closed to deterministic output.
- Administrator-only read, test, save, and disable endpoints.
- Blank API key preserves the existing key; a new key replaces it.
- Failed connection tests do not mutate persistence or runtime state.
- Successful save hot-reloads the next LLM request without restart.
- No response or audit payload contains plaintext or encrypted key material.
- QA sends only allowed chunks and preserves PAS-owned citations.
- Customer analysis uses real completion and preserves rule fallback.
- Proposal accepts valid section JSON and rejects malformed or altered structure.
- Provider error mapping and deterministic fallback for all three features.
- RAGFlow partial model information remains a successful read-only response.

### Frontend

- Menu visibility for admin and absence for sales and technical users.
- Provider presets, custom URL, timeout validation, and responsive field layout.
- Existing-key state, blank-key preservation, replacement-key clearing, and no
  key leakage into cached overview data.
- Independent test, save, disable, and refresh loading/error states.
- RAGFlow fields remain read-only.

### Repository Gates

- Backend and frontend focused tests.
- Full `pnpm test`.
- `pnpm typecheck`.
- `pnpm build`.
- `pnpm compose:config`.
- `pnpm test:smoke` and backend-backed local menu smoke.
- Browser checks at desktop and mobile widths.

## Acceptance Criteria

- An administrator can open `AI 模型接入`, test a supported endpoint, save it,
  and see it become effective without a backend restart.
- Non-admin users cannot see the menu and receive HTTP 403 from every management
  endpoint.
- API keys are encrypted at rest and never returned or logged.
- A failed save test preserves the previous effective configuration.
- QA, customer analysis, and proposal content use the active real model while
  preserving PAS ACL, citation, trace, and review boundaries.
- Provider or output failures produce deterministic fallback rather than broken
  user workflows.
- The RAGFlow tab accurately displays available model and dataset state and has
  no mutation control.
- Existing environment-only deployments continue working until an administrator
  explicitly saves a database configuration.

## Provider References

- Alibaba Cloud Model Studio Base URL overview:
  `https://help.aliyun.com/zh/model-studio/base-url`
- DeepSeek OpenAI-compatible API:
  `https://api-docs.deepseek.com/`
- OpenAI REST API reference:
  `https://platform.openai.com/docs/api-reference`
