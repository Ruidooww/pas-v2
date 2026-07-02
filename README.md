# PAS v2

PAS v2 is the new implementation root for `C:\Users\Ruidoww\Documents\HYYA\AI\PAS项目`.

## Current Scope

- Build a new PAS codebase from the V1.8 taskbook.
- Reuse only RAGFlow assets and integration experience.
- Do not migrate old PAS E0-E5 application code.
- Keep PAS-owned runtime services to four containers:
  - `pas-frontend`
  - `pas-backend`
  - `pas-postgres`
  - `pas-redis`

## Protected Local Assets

These paths are intentionally ignored by Git:

- `external/ragflow/`
- `backups/`
- `.env`, `*.env`, `*.key`

`external/ragflow/` contains copied RAGFlow compose configuration, including `.env`.
`backups/` contains Docker volume backups. Do not commit either path.

## RAGFlow Boundary

The existing RAGFlow stack remains external to PAS and is reached through:

```text
RAGFLOW_BASE_URL=http://host.docker.internal:19380
```

When running backend directly on Windows instead of inside Docker, use:

```text
RAGFLOW_BASE_URL=http://localhost:19380
```

Never run `docker compose down -v` against the RAGFlow stack, and never delete the existing `ragflow_*` volumes.

RAGFlow V0 dataset startup is tracked in:

- `docs/ragflow/v0-dataset-cold-start.md`
- `docs/ragflow/50-question-regression-template.md`

Runtime dataset ids and API keys belong in local environment files only.

## CRM Boundary

PAS V0 reads customer context through backend CRM adapter APIs. The default runtime mode is:

```text
CRM_CLIENT_MODE=mock
```

The mock mode is only a V0 demo profile source for customer analysis and proposal generation. Real CRM integration remains blocked until CRM API documentation, auth method, test account, and confirmed sample customer data are provided.

Frontend and future Bot integrations must call PAS backend APIs only. They must not receive CRM credentials or call CRM systems directly.

## QA Boundary

PAS V0 QA is exposed through backend API only:

```text
POST /api/internal/qa/ask
```

QA answers are draft outputs and must display that they require human review. When retrieval hits exist, answers must include real chunk citations from RAGFlow. When retrieval has no hits, PAS returns a no-hit failure reason instead of fabricating sources.

## Customer Analysis Boundary

PAS V0 customer analysis uses fixed structure, not free-form agent orchestration:

```text
POST /api/internal/customer-analysis/analyze
```

The analysis reads customer context through `CrmModule` and evidence through `RagflowModule`. Key judgments are marked as evidence-backed or inferred, so downstream proposal generation can avoid presenting assumptions as facts.

## Proposal Generation Boundary

PAS V0 proposal generation creates review-required drafts and a stable export handoff package:

```text
POST /api/internal/proposals/generate
GET /api/internal/proposals/:jobId
POST /api/internal/proposals/:jobId/retry
```

The generated `ProposalDraft` is not a customer-ready final proposal. `ExportPackage` is the only downstream contract for docx/pptx/xlsx generation, so export modules do not repeat proposal business logic.

## Compose Skeleton

`docker-compose.yml` defines the four PAS-owned services and their network/volume contract.
Application Dockerfiles and app code are intentionally left for the module implementation issues.

Validate the compose contract with:

```powershell
docker compose config
```

The portable repository command is:

```powershell
pnpm compose:config
```
