# CRM API Token Rotation SOP

Use this procedure after the external CRM issues its daily API token. PAS access remains strictly read-only: validation and runtime CRM calls use `GET` requests only, and PAS never writes data back to the CRM.

## Preconditions

- Run the command on the PAS deployment host from the repository root.
- Docker Desktop and the four PAS containers are already running.
- The deployment `.env` exists and is ignored by Git.
- The token can read `https://demo.sworditsys.com/api/v1/users/options`.

Do not place the token in source files, tickets, screenshots, shell arguments, or shared logs. The ignored deployment `.env` stores the active token as plaintext, so restrict host and file access to operators.

## Daily Rotation

Run:

```powershell
pnpm crm:rotate
```

Enter the new token at the secure prompt. The script then:

1. validates the token with read-only `GET /users/options` before changing local state;
2. atomically sets `CRM_CLIENT_MODE`, `CRM_BASE_URL`, and `CRM_API_TOKEN` in `.env`;
3. recreates only `pas-backend` without rebuilding images or restarting frontend, PostgreSQL, Redis, or RAGFlow;
4. waits for `HYYN-backend` to become healthy and verifies that the container received the new token;
5. restores the previous `.env` and backend configuration automatically if a failure occurs after the update.

No image rebuild or database migration is required for a token rotation.

## Non-Interactive Operation

An approved host secret manager may inject the token into a child PowerShell process through `PAS_CRM_TOKEN_ROTATION_VALUE`. Do not persist this variable at the user or machine scope.

```powershell
# Retrieve the value into $retrievedToken without printing it.
$env:PAS_CRM_TOKEN_ROTATION_VALUE = $retrievedToken
try {
  pnpm crm:rotate
} finally {
  Remove-Item Env:PAS_CRM_TOKEN_ROTATION_VALUE -ErrorAction SilentlyContinue
  $retrievedToken = $null
}
```

Never replace `$retrievedToken` with a literal token in a saved script or command transcript.

## Verification

The command succeeds only after the backend is healthy. An operator can verify the container independently:

```powershell
docker inspect HYYN-backend --format '{{.State.Health.Status}}'
```

Then sign in to PAS and confirm the CRM health indicator or customer list loads. Do not print or inspect the container's complete environment because it contains secrets.

## Failure Handling

- Validation failure: no file or container is changed. Confirm that the CRM has issued the current token and that the host can reach the HTTPS endpoint, then rerun the command.
- Restart failure with successful automatic rollback: PAS continues with the previous runtime configuration. Resolve Docker or compose health issues before retrying.
- Automatic rollback failure: stop further rotations, preserve the current `.env`, and inspect `HYYN-backend` health and Docker events. Do not paste full environment output into logs or tickets.

The script intentionally refuses to write a token to an env file that is not ignored by Git.
