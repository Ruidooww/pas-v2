# PAS V0 Deployment, Smoke, and Rollback SOP

This SOP is the V0 handoff checklist for local or intranet deployment. It keeps RAGFlow external and keeps CI/CD portable across GitHub Actions and a future self-hosted GitLab pipeline.

## Hard Boundaries

- PAS owns only four containers: `HYYN-frontend`, `HYYN-backend`, `HYYN-postgres`, `HYYN-redis`.
  The Docker Compose service names stay `pas-frontend`, `pas-backend`, `pas-postgres`, `pas-redis`.
- RAGFlow stays external. PAS reaches it through `RAGFLOW_BASE_URL`.
- Do not run `docker compose down -v` against RAGFlow.
- Do not delete existing `ragflow_*` Docker volumes.
- Do not commit `.env`, passwords, API keys, JWT secrets, registry credentials, Feishu secrets, or RAGFlow keys.
- `external/ragflow/` and `backups/` are ignored local assets, not PAS deployment inputs.

## Image And CI/CD Contract

Application images are referenced only through OCI image variables:

```text
PAS_BACKEND_IMAGE=${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/pas-backend:${IMAGE_TAG}
PAS_FRONTEND_IMAGE=${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/pas-frontend:${IMAGE_TAG}
```

Rules:

- `IMAGE_TAG` must support commit SHA tags. `main`, `latest`, and environment aliases may be additional tags, not the only traceable version.
- Registry credentials belong in GitHub Secrets or GitLab CI Variables.
- Deployment files must not hardcode `registry.cn-*.aliyuncs.com`, GitHub repository names, fixed branches, or vendor-specific pipeline paths.
- Moving from GitHub Actions to GitLab should replace pipeline orchestration only; app build scripts and compose image references should stay the same.

## Prepare `.env`

Copy the example and fill local values:

```powershell
Copy-Item .env.example .env
notepad .env
```

Minimum values for a usable V0 trial:

```text
PAS_FRONTEND_PORT=18000
PAS_BACKEND_PORT_INTERNAL=3000
PAS_FRONTEND_IMAGE=${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/pas-frontend:${IMAGE_TAG}
PAS_BACKEND_IMAGE=${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/pas-backend:${IMAGE_TAG}

POSTGRES_DB=pas
POSTGRES_USER=pas
POSTGRES_PASSWORD=<local strong password>

JWT_SECRET=<local strong random secret>
AUTH_BOOTSTRAP_ADMIN_USERNAME=<initial admin username>
AUTH_BOOTSTRAP_ADMIN_PASSWORD=<initial admin password>
AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME=<initial admin display name>

CRM_CLIENT_MODE=mock
RAGFLOW_BASE_URL=http://host.docker.internal:19380
RAGFLOW_CLIENT_MODE=real
RAGFLOW_API_KEY=<local RAGFlow API key>
PAS_KB_ID=<V0 PAS dataset id>
QA_KB_ID=<V0 QA dataset id>

EXPORT_TEMPLATE_ROOT=/data/pas-files/export-templates/v0
EXPORT_TEMPLATE_VERSION=<template version>
FEISHU_BOT_ENABLED=false
```

Do not paste real secrets into issue comments, PR descriptions, or chat. Keep them in local `.env` or secret managers.

## Start PAS

Validate the compose contract before starting:

```powershell
docker compose --env-file .env config --services
```

Expected services:

```text
services: pas-frontend, pas-backend, pas-postgres, pas-redis
containers: HYYN-frontend, HYYN-backend, HYYN-postgres, HYYN-redis
```

Pull and start:

```powershell
docker compose --env-file .env pull
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:18000/
```

## Smoke Test

Run the smoke script after the containers are healthy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-v0.ps1 `
  -BaseUrl "http://127.0.0.1:18000" `
  -Username "<initial admin username>" `
  -Password "<initial admin password>"
```

The smoke covers:

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/ragflow/health`
- `GET /api/crm/customers`
- `POST /api/internal/qa/ask`
- `POST /api/internal/customer-analysis/analyze`
- `POST /api/internal/proposals/generate`
- `POST /api/internal/exports`
- `POST /api/internal/feedback`

Full V0 trial cannot be marked ready when:

- login or `/api/me` fails;
- RAGFlow is unreachable when `RAGFLOW_CLIENT_MODE=real`;
- QA/customer analysis/proposal generation fails;
- export templates are missing for required deliverable formats;
- the 50-question regression report is missing, incomplete, or failed.

## 50-Question Regression Gate

Submit a regression run only with the real 50-question set:

```powershell
# Example shape only. Use the approved 50-question file for real gate runs.
$headers = @{ Authorization = "Bearer <token>" }
$body = @{
  name = "PAS V0 50-question regression"
  owner = "<owner>"
  approver = "<approver>"
  cases = @()
} | ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/internal/regression-runs" -Headers $headers -ContentType "application/json" -Body $body
```

Go-live rule:

- `canGoLive=true` and `gateStatus=passed` are required.
- Fewer than 50 cases returns `REGRESSION_QUESTION_SET_INCOMPLETE`.
- Any failed case returns `REGRESSION_CASES_FAILED`.

## Rollback

Rollback uses the previous image tag. Do not delete volumes during rollback.

```powershell
notepad .env
# Set PAS_BACKEND_IMAGE and PAS_FRONTEND_IMAGE back to the previous commit SHA tag.

docker compose --env-file .env pull pas-backend pas-frontend
docker compose --env-file .env up -d pas-backend pas-frontend
docker compose --env-file .env ps
```

After rollback, rerun `scripts/smoke-v0.ps1`.

Database rollback is not automated in V0. If a migration changes data destructively, stop and run a manual restore plan from the approved database backup. Do not run destructive RAGFlow commands.

## Residual Risks And Review Notices

- V0 proposal and QA outputs are review-required drafts, not customer-ready final deliverables.
- Export success depends on approved company templates under `EXPORT_TEMPLATE_ROOT`.
- Feishu is a disabled-by-default integration boundary until app credentials, callback settings, and user mapping are confirmed.
- CRM runs in mock mode until real CRM API documentation, auth, and sample customer data are provided.
- RAGFlow remains an external dependency and must be validated before any trial.
