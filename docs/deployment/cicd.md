# CI/CD

PAS v2 uses provider-neutral repository scripts as the build contract.
The first runner is GitHub Actions, but the same commands must remain usable from a future self-hosted GitLab CI pipeline.

## Source Of Truth

These commands are the portable contract:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm compose:config
```

Docker images are built through:

```powershell
$env:REGISTRY_HOST="registry.example.com"
$env:REGISTRY_NAMESPACE="team/pas-v2"
$env:IMAGE_TAG="<commit-sha>"
$env:PUSH_IMAGES="0"
pnpm ci:images
```

Set `PUSH_IMAGES=1` only in a trusted publish pipeline after registry login.

## Registry Variables

The scripts use generic OCI registry variables:

```text
REGISTRY_HOST
REGISTRY_NAMESPACE
IMAGE_TAG
REGISTRY_USERNAME
REGISTRY_PASSWORD
PUSH_IMAGES
```

For GitHub Actions, store `REGISTRY_HOST` and `REGISTRY_NAMESPACE` as repository variables, and store `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` as repository secrets.

For a future GitLab CI migration, map GitLab variables to the same names before running the same scripts.

## Image Names

The image references are:

```text
${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/pas-backend:${IMAGE_TAG}
${REGISTRY_HOST}/${REGISTRY_NAMESPACE}/pas-frontend:${IMAGE_TAG}
```

`IMAGE_TAG` must support commit SHA values. Branch aliases such as `main` or `latest` can be added later, but they must not be the only deployable tag.

## Boundaries

- Do not hardcode ACR endpoints, GitHub repository names, or GitLab project names in scripts.
- Do not read `GITHUB_*`, `GITLAB_*`, `CI_*`, or `ACR_*` variables from application code.
- Do not build PAS-owned images for PostgreSQL or Redis.
- Do not add PAS-owned images for worker, scheduler, migrator, MinIO, RAGFlow, or agent runtime services.
