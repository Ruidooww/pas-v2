# V2 Business Flow Code Layer Design

## Scope

V2 upgrades PAS from a proposal/export tool into a usable presales business loop. This code-layer pass implements the runnable system boundaries for:

- opportunity extraction and human confirmation
- meeting minutes, structured requirements, and meeting-driven proposal handoff
- offline contract review with deterministic risk rules
- after-sales Q&A escalation and maintenance reminders
- channel read-only context and channel proposal variables
- customer profile/signals/action suggestions
- business event metrics for the V3 dashboard

Business-material gates remain outside this PR: real CRM write-back credentials, ASR service, contract samples and legal rulebooks, channel pricing files, production templates, and pilot sign-off scenarios. The code must expose stable adapters and pending states so those inputs can be added later without changing V0/V1 rollback paths.

## Architecture

Add a backend `BusinessFlowModule` with one controller, one service, and one in-memory store mirrored through `PersistenceSink`. The module owns a single `BusinessFlowRecord` shape with `kind`, `status`, `source`, `payload`, `outputs`, and append-only `events`. This avoids seven separate demo modules and keeps source, confirmation, and cross-system audit behavior consistent.

The service uses existing ports where they already exist:

- `CrmClient` for customer context.
- `ProposalService` for meeting-to-proposal handoff.
- `PersistenceSink` for optional Postgres snapshots.

The frontend adds a `BusinessFlowsPage` behind a new sidebar item. It is an operator console for V2 code paths, not a marketing page: each tab has compact inputs, action buttons, result panels, and a metrics view.

## Data and Security

Every record includes `ownerUserId`, `ownerRole`, `sourceSystem`, `sourceRef`, and `createdAt/updatedAt`. Read access is conservative:

- `admin` sees all records.
- `sales` sees records they created plus opportunity/channel/customer-signal records.
- `presales` sees records they created plus meeting/contract/after-sales/customer-signal records.

Actions that represent external write-back do not call an unconfigured system. They create a `pending_external_sync` event after human confirmation. This satisfies the V2 safety rule that CRM/business-system writes require human confirmation and audit logs.

## API

New authenticated routes live under `/api/internal/business-flows`:

- `POST /opportunities/extract`
- `PATCH /opportunities/:recordId/confirm`
- `POST /opportunities/:recordId/sync-request`
- `POST /meetings/summarize`
- `POST /meetings/:recordId/proposal`
- `POST /contracts/review`
- `PATCH /contracts/:recordId/confirm`
- `POST /after-sales/answer`
- `POST /after-sales/maintenance-reminders`
- `POST /channels/context`
- `POST /customer-signals/analyze`
- `GET /records`
- `GET /metrics`

The API returns deterministic data. Where an external dependency is missing, the response includes a `pendingInputs` entry instead of failing.

## Testing

Backend tests cover service behavior before implementation:

- text opportunity extraction produces a pending-confirmation record with source and metrics events
- CRM sync request is rejected until human confirmation
- meeting summary can create a proposal job using meeting requirements as human inputs
- contract review produces risk points and requires confirmation
- after-sales reminder dates produce 90/60/30 day reminders
- channel context identifies duplicate-registration risk and proposal variables
- customer signals include evidence sources and action suggestions
- role filtering prevents unrelated users from seeing private records
- `PersistenceSink` mirrors and hydrates V2 records

Frontend tests cover that the V2 page is reachable from the sidebar once authenticated.

## Rollback

V0/V1 modules remain untouched except for adding `BusinessFlowModule` to `AppModule`, adding one sidebar route, and extending `PersistenceSink` with one optional snapshot table. If V2 is not accepted, the branch can be left unmerged or reverted without affecting existing QA, proposal, export, knowledge, and template workflows.
