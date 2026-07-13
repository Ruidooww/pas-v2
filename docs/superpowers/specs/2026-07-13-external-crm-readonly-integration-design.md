# External CRM Read-Only Integration Design

## Goal

Connect PAS to the external CRM at `https://demo.sworditsys.com` so customer
management, customer analysis, and proposal generation can use current CRM
customer context without allowing PAS to create, update, delete, or write back
any CRM data.

## Confirmed Boundary

The integration is read-only by design:

- The CRM token exists only in the PAS backend process environment.
- The external adapter sends only HTTP `GET` requests.
- PAS does not expose a generic CRM request proxy.
- PAS does not implement CRM create, update, delete, synchronization, webhook,
  or write-back methods.
- CRM failures never trigger a write, synchronization job, or fallback to mock
  customer data.
- The token, authorization header, raw CRM response body, and customer-sensitive
  fields are never logged, audited, returned to the frontend, or committed to
  Git.

The first release reads only:

- customers;
- customer details;
- contacts;
- customer follow-ups;
- opportunities;
- the read-only user option list required to resolve owner identifiers.

Materials, work orders, contracts, projects, products, shipments, and all other
CRM modules are out of scope. `purchasedProducts` remains an empty array in the
PAS customer context.

## Selected Approach

Add a real-time `ExternalCrmClient` behind the existing `CrmClient` interface.
`CrmModule` selects `MockCrmClient` or `ExternalCrmClient` from
`CRM_CLIENT_MODE`. Existing PAS controllers and consumers continue using the
same dependency-injection token.

This approach was selected over a scheduled database mirror or a separate CRM
gateway. It keeps data current, introduces no second source of truth, and fits
the current single-CRM trial deployment. PAS explicitly reports upstream
failure instead of serving stale or sample data as if it were real.

## Configuration

The backend configuration is:

```text
CRM_CLIENT_MODE=external
CRM_BASE_URL=https://demo.sworditsys.com/api/v1
CRM_API_TOKEN=<server-only token>
CRM_TIMEOUT_MS=10000
```

Mock remains the default when `CRM_CLIENT_MODE` is absent. External mode fails
configuration validation when the base URL or token is missing.

The external URL policy requires:

- protocol `https`;
- hostname exactly `demo.sworditsys.com`;
- path exactly `/api/v1`, normalized without a trailing slash;
- no username, password, query string, or fragment;
- redirects disabled on every request.

The token is supplied through the ignored local `.env` file or deployment
secret injection. It is not persisted in PostgreSQL. Docker Compose forwards
the four CRM environment variables to the backend container without assigning
a non-secret default token.

## Backend Components

### CRM Configuration

Extend `CrmConfig` with normalized `baseUrl`, `apiToken`, and `timeoutMs`.
Timeout is constrained to a small operational range, with `10000` milliseconds
as the default.

### External CRM Client

`ExternalCrmClient` implements the existing methods:

```text
listCustomers()
getCustomer(customerId)
getCustomerContext(customerId)
```

The client receives an injectable fetcher for deterministic tests. Its private
request helper accepts only a fixed relative path and always sends:

```text
method: GET
redirect: error
Accept: application/json
Authorization: Bearer <CRM_API_TOKEN>
signal: AbortSignal.timeout(CRM_TIMEOUT_MS)
```

No business service receives the token, base URL, fetcher, or generic request
helper.

### Client Selection

`CrmModule` constructs `MockCrmClient` in mock mode and `ExternalCrmClient` in
external mode. `MockCrmClient` no longer owns the external-mode rejection path.
External mode never catches an upstream error and substitutes mock customers.

### Data Source Metadata

`GET /api/crm/customers` adds a non-secret source field:

```json
{
  "source": "external",
  "customers": []
}
```

The value is `mock` in mock mode. This metadata is owned by PAS configuration,
not inferred from record contents.

## Confirmed External Read Endpoints

Live read-only probes on 2026-07-13 confirmed these requests with HTTP 200:

```text
GET /customers
GET /customers/:customerId
GET /customers/:customerId/contacts
GET /customers/:customerId/followups
GET /opportunities?customerId=:customerId
GET /users/options
```

The customer, follow-up, and opportunity list responses use `data` plus a
`meta` object containing `total`, `page`, `pageSize`, and `totalPages`.
`/users/options` returns entries containing `id` and `name`. Direct
`GET /users/:id` is not used because it is not available through this token.

The probe confirmed 57 customers and 127 opportunities at the time of testing.
These counts are evidence of connectivity, not acceptance-test constants.

## Data Flow

### Customer List

```text
PAS customer page
  -> GET /api/crm/customers
  -> ExternalCrmClient
  -> GET CRM /users/options
  -> GET all CRM /customers pages
  -> map owner IDs and customer summaries
  -> PAS response with source=external
```

The client requests bounded pages and stops at `meta.totalPages`. A maximum page
limit prevents malformed metadata from causing an unbounded request loop.
Customer summaries map:

| PAS field | CRM field |
| --- | --- |
| `customerId` | `id` |
| `name` | `name` |
| `industry` | `industry` |
| `region` | `region` |
| `accountOwner` | name resolved from `ownerId`, otherwise `ownerId` |

### Customer Detail And Context

After the customer detail is found, PAS fetches contacts, follow-ups,
opportunities, and user options concurrently. The result is mapped into the
existing `CrmCustomerContext`; `purchasedProducts` is `[]`.

Contacts map as follows:

- `name` from `name`;
- `title` from `title`, falling back to `department` and then an empty string;
- `role=decision_maker` when `isKeyPerson=true`;
- otherwise `role=technical_evaluator` when `isTechContact=true`;
- otherwise `role=business_user`.

Follow-ups map:

- `happenedAt` from `followupAt`;
- `owner` from the name resolved from `createdBy`, otherwise `createdBy`;
- `summary` from `content`.

Opportunities map:

- `opportunityId` from `id`;
- `name` from `name`;
- `estimatedValue` from a strict finite-number conversion of
  `estimatedAmount`, otherwise `0`;
- `expectedCloseDate` from `estimatedCloseAt` normalized as an ISO date.

Active CRM stages map to PAS stages:

| CRM stage | PAS stage |
| --- | --- |
| `INITIAL_CONTACT`, `VISITED`, `NEEDS_CONFIRMED` | `discovery` |
| `SOLUTION_SHARED`, `POC_TEST`, `QUOTING` | `proposal` |
| `BUSINESS_ADVANCING`, `PENDING_SIGN` | `negotiation` |
| `WON` | `won` |

`PAUSED`, `LOST`, and `CLOSED` opportunities do not enter the active PAS
customer context. Unknown future stage values are also excluded instead of
being silently assigned an incorrect active stage.

## Response Validation

CRM payloads are treated as untrusted external input. Mapping uses structural
checks rather than TypeScript casts. A list response must contain an array in
`data`; detail responses must contain an object with a non-empty identifier and
name. Optional malformed child records are skipped. A structurally invalid root
response fails the request instead of being interpreted as an empty customer
pool.

All URL path identifiers use `encodeURIComponent`. Query strings are built with
`URLSearchParams`; external values are never concatenated into a host or
protocol.

## Error Contract

The adapter maps failures to stable CRM error categories:

- `CRM_AUTHENTICATION_FAILED`: upstream HTTP 401 or 403;
- `CRM_NOT_FOUND`: upstream customer detail HTTP 404;
- `CRM_RATE_LIMITED`: upstream HTTP 429;
- `CRM_UNAVAILABLE`: timeout, network failure, or upstream 5xx;
- `CRM_RESPONSE_INVALID`: malformed JSON or invalid response structure;
- `CRM_REQUEST_REJECTED`: other upstream 4xx responses.

The PAS customer controller maps customer not found to HTTP 404, temporary CRM
availability and rate-limit failures to HTTP 503, and invalid/rejected upstream
responses to HTTP 502. Upstream authentication failure is reported as a CRM
configuration problem, not as a failed PAS user login.

Public errors contain only the stable category and a concise message. They do
not include the upstream body, request authorization, customer data, or token.

## Frontend Behavior

The customer management page keeps its current layout and drilldowns. It uses
the list response `source` to avoid misleading labels:

- external mode: `CRM 客户池`, `CRM 数据`;
- mock mode: `客户样例池`, `样例`.

The current hard-coded statement that the page always uses built-in sample data
is replaced with source-aware copy. Existing loading, error, grouping, and empty
states remain. No CRM token or external endpoint is exposed to the browser.

## Tests

### Backend Unit Tests

- Configuration defaults to mock and validates external URL, token, and timeout.
- Module factory selects the correct client without fallback.
- Every external request uses `GET`, disables redirects, applies timeout, and
  sends the bearer token only in the authorization header.
- Customer pagination reads all bounded pages and terminates from `meta`.
- Customer, contact, follow-up, owner, amount, date, and stage mappings match
  the confirmed response shapes.
- Inactive and unknown opportunity stages are excluded.
- Missing owner options fall back to the corresponding identifier.
- HTTP 401, 403, 404, 429, 5xx, timeout, invalid JSON, and invalid structure map
  to the approved errors.
- Error messages and serialized responses contain no token or raw CRM body.

### Backend Integration Tests

- Mock mode preserves the current customer endpoints.
- External mode uses a local fake HTTP server and returns mapped PAS DTOs.
- A fake-server request ledger proves that no non-`GET` request occurs.
- External failure never returns mock records.
- Customer analysis and proposal generation can consume a mapped external
  customer context.

CI never uses the live CRM token or live CRM service.

### Frontend Tests

- External responses show CRM-specific copy and status.
- Mock responses preserve sample-specific copy and status.
- Customer grouping and statistic drilldowns work for external records.
- API errors produce the existing visible error state without stale mock data.

### Repository And Live Verification

- Focused backend and frontend tests.
- Full backend and frontend test suites.
- Typecheck and production build.
- Docker Compose configuration validation.
- Existing PAS smoke test.
- Local backend with external mode and a non-committed token.
- Browser verification of the customer list, customer analysis selection, and
  one proposal task using a real CRM customer.
- Read-only request evidence confirms the live verification issued only `GET`.

## Rollout

1. Deploy the code with `CRM_CLIENT_MODE=mock`; behavior remains unchanged.
2. Inject `CRM_BASE_URL`, `CRM_API_TOKEN`, and `CRM_TIMEOUT_MS` into the backend
   environment.
3. Switch to `CRM_CLIENT_MODE=external` and restart only the backend.
4. Run customer list and detail smoke checks.
5. Run one customer analysis and one proposal generation flow.
6. Confirm the customer page identifies the source as CRM data.
7. Inspect sanitized backend errors and request method evidence; confirm no
   write method occurred.

Rollback switches `CRM_CLIENT_MODE` to `mock` and restarts the backend. Rollback
does not modify CRM data because PAS has no CRM mutation path.

## Acceptance Criteria

- PAS lists the current external CRM customer pool rather than built-in sample
  customers when external mode is enabled.
- Customer analysis and proposal generation receive mapped contacts, active
  opportunities, and follow-up context for a selected real customer.
- Customer owners and follow-up creators show names from `/users/options` when
  available and identifiers otherwise.
- External CRM outages and permission failures are visible and never replaced
  with mock records.
- The browser, PAS API responses, logs, audit records, Git history, and database
  never contain the CRM token.
- Automated request assertions and live verification show that PAS sends only
  approved CRM `GET` requests.
- No CRM create, update, delete, synchronization, or write-back code exists in
  this release.
