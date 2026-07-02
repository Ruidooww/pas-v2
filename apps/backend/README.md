# PAS Backend

NestJS API app placeholder for the V0 implementation.

The backend container owns all PAS business modules, background processors, schedulers, and adapters.
Do not split worker, MinIO, RAGFlow, or agent runtime containers into the PAS-owned compose stack.

The baseline health endpoint is `GET /api/health`.

RAGFlow backend endpoints:

- `GET /api/ragflow/health`
- `POST /api/ragflow/search`

Frontend and Bot integrations must call these PAS backend endpoints instead of calling RAGFlow directly.

CRM backend endpoints:

- `GET /api/crm/customers`
- `GET /api/crm/customers/:customerId`
- `GET /api/crm/customers/:customerId/context`

`CRM_CLIENT_MODE=mock` is the V0 default. External CRM mode is reserved until API documentation and test credentials are available.
