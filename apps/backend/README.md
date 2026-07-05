# PAS Backend

NestJS API app placeholder for the V0 implementation.

The backend container owns all PAS business modules, background processors, schedulers, and adapters.
Do not split worker, MinIO, RAGFlow, or agent runtime containers into the PAS-owned compose stack.

The baseline health endpoint is `GET /api/health`.

RAGFlow backend endpoints:

- `GET /api/ragflow/health`
- `POST /api/ragflow/search`

Frontend and Bot integrations must call these PAS backend endpoints instead of calling RAGFlow directly.
`GET /api/ragflow/health` is public for readiness checks; `POST /api/ragflow/search` requires `Authorization: Bearer <token>`.

CRM backend endpoints:

- `GET /api/crm/customers`
- `GET /api/crm/customers/:customerId`
- `GET /api/crm/customers/:customerId/context`

`CRM_CLIENT_MODE=mock` is the V0 default. External CRM mode is reserved until API documentation and test credentials are available.
CRM endpoints require `Authorization: Bearer <token>` because mock records still model customer context.

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

Knowledge block endpoints:

- `POST /api/internal/knowledge-blocks`
- `GET /api/internal/knowledge-blocks`
- `GET /api/internal/knowledge-blocks/published`
- `GET /api/internal/knowledge-blocks/:blockId`
- `POST /api/internal/knowledge-blocks/:blockId/submit-review`
- `POST /api/internal/knowledge-blocks/:blockId/review`
- `POST /api/internal/knowledge-blocks/:blockId/disable`

Knowledge blocks use the V1 lifecycle `draft -> pending_review -> published`, with `rejected`, `disabled`, and `expired` terminal or operator-controlled states. Only published blocks are returned by the published-only endpoint, which is reserved for later deterministic ProposalModule and ExportModule fill.

Knowledge document operations endpoints:

- `POST /api/internal/knowledge-documents`
- `GET /api/internal/knowledge-documents`
- `GET /api/internal/knowledge-documents/:documentId`
- `POST /api/internal/knowledge-documents/:documentId/tags`
- `POST /api/internal/knowledge-documents/:documentId/enabled`
- `POST /api/internal/knowledge-documents/:documentId/reparse`

Document operations store PAS-side metadata for documents already managed in RAGFlow: parse status, chunk count, hit count, bad feedback count, tags, and enabled state. Reparse requests are tracked as PAS operations metadata; they do not mutate RAGFlow volumes or datasets.
Document visibility supports public, role-scoped, and user-scoped access. When document metadata exists, QA retrieval passes the current user's accessible document ids to the RAGFlow adapter and chunks outside that allow-list are filtered before answer drafting.

Feedback endpoints:

- `POST /api/internal/feedback`
- `GET /api/internal/feedback`
- `PATCH /api/internal/feedback/:feedbackId`

Regression endpoints:

- `POST /api/internal/regression-runs`
- `GET /api/internal/regression-runs/:runId`
- `GET /api/internal/regression-runs/:runId/report`

Regression reports mark `canGoLive=false` when the 50-question set is incomplete or any case fails.

Feishu integration endpoint:

- `POST /api/integrations/feishu/events`

`FEISHU_BOT_ENABLED=false` is the default. When enabled, callbacks require `x-feishu-timestamp`, `x-feishu-nonce`, and `x-feishu-signature`; message events are answered through `QaModule` only.
