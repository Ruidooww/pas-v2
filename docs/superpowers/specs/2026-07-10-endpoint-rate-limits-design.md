# Endpoint Rate Limits Design

**Goal:** Close the remaining high-risk part of review item #9 by applying stricter rate limits to login and QA requests without changing authentication or business API contracts.

## Current Gap

`AppModule` applies one in-memory `ThrottlerGuard` limit of `120` requests per minute to every route. The login and QA endpoints therefore have no stricter protection against password guessing or expensive repeated QA requests.

The frontend Nginx already sends `X-Forwarded-For`, but the backend does not currently trust a controlled proxy hop. Without that setting, all requests forwarded by the frontend container can share the Nginx container IP as their throttle identity.

## Selected Design

Keep the existing global guard and add endpoint-level `@Throttle` limits:

| Scope | Environment variable | Default |
| --- | --- | ---: |
| All endpoints | `THROTTLE_LIMIT_PER_MINUTE` | `120` |
| `POST /api/auth/login` | `THROTTLE_LOGIN_LIMIT_PER_MINUTE` | `10` |
| `POST /api/internal/qa/ask` | `THROTTLE_QA_LIMIT_PER_MINUTE` | `30` |

All three windows remain `60_000` milliseconds. The endpoint limits count both successful and failed requests and use the existing Nest throttler response when exceeded: HTTP `429 Too Many Requests`.

No new dependency or rate-limit storage service is introduced.

## Proxy Identity

The request path is:

```text
browser -> optional HTTPS terminator -> pas-frontend Nginx -> pas-backend
```

The backend application defaults `TRUST_PROXY_HOPS` to `0`. Docker Compose falls back to `1` for the local single-proxy path because `pas-backend` is private to the PAS network and receives browser API traffic through `pas-frontend`. A release with a separate HTTPS terminator in front of `pas-frontend` must set `TRUST_PROXY_HOPS=2`. The configured value must equal the actual number of trusted proxy hops so Express stops at the client address instead of a proxy address or an untrusted forwarded value.

The existing Nginx `X-Real-IP` and `X-Forwarded-For` headers stay unchanged.

## Configuration

A small throttle configuration module will parse positive integer environment values and fall back to the documented defaults when a variable is missing or invalid. `AppModule`, `AuthController`, and `QaController` will consume the same parsed configuration so defaults cannot drift.

`.env.example` and `docker-compose.yml` will expose the endpoint limits and proxy-hop setting. The deployment SOP will state that trusting any proxy hops assumes the backend is not published directly and will document `1` for local frontend-only proxying and `2` for the approved HTTPS-terminator topology.

## Tests

- Configuration tests cover defaults, valid overrides, and invalid-value fallback.
- Controller tests inspect Nest throttler metadata to prove login uses `10/min` and QA uses `30/min` by default.
- Proxy configuration tests prove zero hops leaves Express unchanged and configured positive hop counts set the matching `trust proxy` value.
- Existing backend tests, typecheck, build, Compose validation, and smoke tests must remain green.

## Non-Goals

- Account lockout, exponential login delay, CAPTCHA, or username-based tracking.
- Redis-backed distributed counters. The current deployment has one backend instance; distributed storage is required before horizontal backend scaling.
- Automatic frontend retry after HTTP 429.
- Changes to authentication responses, QA payloads, or global authorization behavior.

## Acceptance Criteria

- Login and QA routes carry stricter, independently configurable limits.
- Requests forwarded through the documented proxy topologies are tracked by client IP when `TRUST_PROXY_HOPS` matches the deployed topology.
- Invalid numeric environment values do not silently disable throttling.
- Review item #9 distinguishes the completed CSRF/session work from this completed endpoint-rate-limit work.
- Only files required for rate limiting, tests, deployment configuration, and remediation status are changed.
