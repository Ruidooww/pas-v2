# V3 Platform Code Layer Design

## Goal

Build the V3 code layer for PAS platformization without waiting on external IM, CRM, billing, OCR, or production BI inputs. The implementation must keep the current four-container boundary and preserve V0/V1/V2 rollback paths.

## Scope

V3 covers the taskbook groups V3-01 to V3-08:

- Multi-channel entry with a unified message/session model and task-result notification records.
- Agent, Skill, and workflow metadata with safety review, approval, execution, and audit logs.
- Executive dashboard metrics for sales, presales, knowledge, proposal/export, channel, contract, and pending-input views.
- Product registry for non-IP-Guard or partner products, including knowledge partitions, templates, webhook events, API version, and plugin dependencies.
- CIP deepening with deterministic customer signals and action suggestions.
- Multi-organization/commercialization reservation that does not affect the single-organization internal mode.
- Platform security and audit summaries for channel, API, webhook, Agent/Skill, and sensitive operations.
- Trial-readiness status that shows what is code-ready and what still needs business inputs.

## Architecture

Add a new backend `PlatformModule` under `apps/backend/src/platform`. It owns V3 types, an in-memory store, persistence snapshot hydration, deterministic services, and an authenticated internal controller at `/api/internal/platform`. The module imports `BusinessFlowModule` so dashboard metrics can read V2 business records instead of duplicating data.

Frontend adds a `V3 平台化` page with compact operational sections: dashboard, channel gateway, Agent/Skill workflow, product registry, CIP signals, tenant/commercial reservation, and security audit. The page uses existing `api()` and Ant Design patterns.

## Persistence

V3 state is mirrored through one Prisma snapshot table, `platform_state_snapshots`. The hot path remains in memory, matching existing V0-V2 stores. Persistence failure must not block request handling.

## Boundaries

External enterprise IM callbacks, real billing, real CRM writeback, real OCR, and real BI pipelines are represented as explicit pending inputs. No new container, worker, MinIO, or standalone Agent runtime is introduced.

## Testing

Backend service tests cover dashboard aggregation, message routing, Skill review/approval, workflow execution, product registration, CIP signal detection, tenant preservation, and audit summary. Controller tests cover validation and authenticated delegation. Frontend tests cover the V3 menu/page and key panels.
