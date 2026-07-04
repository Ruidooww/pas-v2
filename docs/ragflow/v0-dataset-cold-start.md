# V0 Dataset Cold Start

This document tracks the PAS V0 dataset startup workflow. It must not contain real API keys or long-lived secrets.

## Boundary

- The existing RAGFlow stack remains outside PAS.
- PAS reaches RAGFlow through `RAGFLOW_BASE_URL`.
- The old `IP-Guard-Gate` knowledge base is a source reference only. It is not the all-user PAS V0 dataset.
- The new V0 dataset ID must be stored in local runtime configuration as `PAS_KB_ID`, not committed to Git.
- `QA_KB_ID` is reserved for a QA-specific dataset when the V0 workflow splits knowledge scopes.

## Required Inputs

The V0 local closeout uses these approved inputs:

| Input | Owner | Status | Notes |
| --- | --- | --- | --- |
| 30-50 curated source materials | User side / RAGFlow operator | Done | The local V0 RAGFlow dataset has 50 selected IP-Guard materials. |
| New PAS V0 dataset ID | User side / RAGFlow operator | Done locally | Store as `PAS_KB_ID` in local `.env`; do not commit dataset IDs. |
| 50 real regression questions | User side | Approved | `docs/ragflow/v0-candidate-regression-questions.json` is marked `approved` for the V0 gate. |

If the approved 50-question set is replaced later, mark the replacement cases with reviewed evidence before using them
as the V0 go-live regression gate input.

## Import Rules

- Import only the curated 30-50 materials into the V0 dataset.
- Do not bulk-import the old 204-document `IP-Guard-Gate` KB into the V0 all-user dataset.
- Keep any exported source files, RAGFlow compose files, backups, `.env`, and key files out of Git.
- Record imported document names and review owners in an operational note, not in code.

## Runtime Fields

Use local environment values:

```text
RAGFLOW_BASE_URL=http://host.docker.internal:19380
RAGFLOW_CLIENT_MODE=real
RAGFLOW_KEYWORD_ENABLED=true
RAGFLOW_FALLBACK_QUERY_PREFIX=IP-Guard
RAGFLOW_API_KEY=<local secret>
PAS_KB_ID=<new V0 dataset id>
QA_KB_ID=<optional QA dataset id>
```

For backend running directly on Windows, use:

```text
RAGFLOW_BASE_URL=http://localhost:19380
```

The RAGFlow UI may be checked at `http://localhost:80` on the preserved local stack. The API endpoint
`/api/v1/datasets` should return `401` when `RAGFLOW_API_KEY` is missing; that confirms the API route is reachable but
does not prove PAS can retrieve knowledge chunks.

Keep `RAGFLOW_KEYWORD_ENABLED=true` for the V0 Chinese IP-Guard dataset. It makes PAS send RAGFlow retrieval requests
with `keyword=true`, which is required for broad Chinese presales questions that vector-only retrieval can miss. When
RAGFlow returns no chunks or a non-zero business code, PAS retries once with `RAGFLOW_FALLBACK_QUERY_PREFIX` prepended
and conservative keyword-biased retrieval tuning.

## Adapter Contract

PAS maps RAGFlow retrieval chunks into:

| Field | Description |
| --- | --- |
| `chunkId` | RAGFlow chunk id. |
| `documentId` | Source document id. |
| `title` | Document title or keyword. |
| `content` | Retrieved chunk text. |
| `score` | Retrieval similarity score. |
| `source` | User-facing source label. |

Frontend and Feishu Bot integrations must call PAS backend endpoints only. They must not call RAGFlow directly.
