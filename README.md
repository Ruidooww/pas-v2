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

## Compose Skeleton

`docker-compose.yml` defines the four PAS-owned services and their network/volume contract.
Application Dockerfiles and app code are intentionally left for the module implementation issues.

Validate the compose contract with:

```powershell
docker compose config
```
