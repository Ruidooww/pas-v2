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

QA backend endpoint:

- `POST /api/internal/qa/ask`

QA uses the backend RAGFlow adapter and returns draft answers with citations. Draft answers must be treated as review-required output.

Customer analysis endpoint:

- `POST /api/internal/customer-analysis/analyze`

Customer analysis uses fixed structure and marks each judgment as `evidence` or `inferred`.

Proposal generation endpoints:

- `POST /api/internal/proposals/generate`
- `GET /api/internal/proposals/:jobId`
- `POST /api/internal/proposals/:jobId/retry`

Proposal generation returns a review-required `ProposalDraft` plus an `ExportPackage` for downstream docx/pptx/xlsx export.

Export endpoints:

- `POST /api/internal/exports`
- `GET /api/internal/exports/:jobId`
- `GET /api/internal/exports/:jobId/files/:format`

Export tasks accept `ExportPackage`, track each requested format independently, and save/read files only through `FilesModule`. Until company templates are placed under `EXPORT_TEMPLATE_ROOT`, the renderer returns explicit template errors instead of producing fake files.

Auth endpoints:

- `POST /api/auth/login`
- `GET /api/me`
- `POST /api/internal/auth/users`
- `POST /api/internal/auth/users/import`

Audit endpoint:

- `GET /api/internal/audit/events`

Internal APIs require `Authorization: Bearer <token>`. Bootstrap admin creation only runs when `AUTH_BOOTSTRAP_ADMIN_USERNAME` and `AUTH_BOOTSTRAP_ADMIN_PASSWORD` are provided by the local environment.
