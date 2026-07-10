# Endpoint Rate Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently configurable login and QA rate limits and preserve real client IP tracking through the documented proxy topologies.

**Architecture:** Keep the existing global `ThrottlerGuard`, centralize validated request-protection environment values in `throttle.config.ts`, and apply endpoint `@Throttle` metadata to login and QA. Configure Express `trust proxy` only when a validated hop count is positive; Compose supplies one hop for the local frontend proxy while release documentation requires two hops when a separate TLS terminator is present.

**Tech Stack:** NestJS 11, `@nestjs/throttler` 6, TypeScript 6, Vitest 4, Docker Compose, Nginx.

## Global Constraints

- Keep the global throttle window at `60_000` milliseconds and default limit at `120` requests.
- Default login to `10` requests per minute and QA to `30` requests per minute.
- Do not add dependencies, account lockout, CAPTCHA, automatic retries, or Redis-backed throttle storage.
- Application default `TRUST_PROXY_HOPS` is `0`; Compose fallback is `1`; the approved TLS-terminator topology uses `2`.
- Invalid or non-integer numeric environment values fall back to safe defaults.
- Keep `pas-backend` private when any proxy hops are trusted.
- Do not modify or commit the unrelated `design-qa.md` file.

---

### Task 1: Validated Throttle Configuration

**Files:**
- Create: `apps/backend/src/throttle.config.ts`
- Create: `apps/backend/src/throttle.config.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Produces: `createThrottleConfig(env?: ThrottleEnv): ThrottleConfig`.
- Produces: `ThrottleConfig` with `ttlMs`, `globalLimit`, `loginLimit`, `qaLimit`, and `trustProxyHops` numeric fields.
- Consumed later by `AppModule`, `AuthController`, `QaController`, and `main.ts`.

- [ ] **Step 1: Write the failing configuration tests**

Create `apps/backend/src/throttle.config.spec.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createThrottleConfig } from "./throttle.config";

describe("createThrottleConfig", () => {
  it("uses safe request-protection defaults", () => {
    expect(createThrottleConfig({})).toEqual({
      ttlMs: 60_000,
      globalLimit: 120,
      loginLimit: 10,
      qaLimit: 30,
      trustProxyHops: 0
    });
  });

  it("accepts positive integer limits and a non-negative proxy hop count", () => {
    expect(
      createThrottleConfig({
        THROTTLE_LIMIT_PER_MINUTE: "240",
        THROTTLE_LOGIN_LIMIT_PER_MINUTE: "8",
        THROTTLE_QA_LIMIT_PER_MINUTE: "45",
        TRUST_PROXY_HOPS: "2"
      })
    ).toEqual({
      ttlMs: 60_000,
      globalLimit: 240,
      loginLimit: 8,
      qaLimit: 45,
      trustProxyHops: 2
    });
  });

  it("falls back when numeric values are invalid", () => {
    expect(
      createThrottleConfig({
        THROTTLE_LIMIT_PER_MINUTE: "0",
        THROTTLE_LOGIN_LIMIT_PER_MINUTE: "-1",
        THROTTLE_QA_LIMIT_PER_MINUTE: "1.5",
        TRUST_PROXY_HOPS: "-1"
      })
    ).toEqual({
      ttlMs: 60_000,
      globalLimit: 120,
      loginLimit: 10,
      qaLimit: 30,
      trustProxyHops: 0
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/throttle.config.spec.ts
```

Expected: FAIL because `./throttle.config` does not exist.

- [ ] **Step 3: Implement the configuration parser**

Create `apps/backend/src/throttle.config.ts`:

```typescript
const THROTTLE_WINDOW_MS = 60_000;

type ThrottleEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "THROTTLE_LIMIT_PER_MINUTE"
    | "THROTTLE_LOGIN_LIMIT_PER_MINUTE"
    | "THROTTLE_QA_LIMIT_PER_MINUTE"
    | "TRUST_PROXY_HOPS"
  >
>;

export type ThrottleConfig = {
  ttlMs: number;
  globalLimit: number;
  loginLimit: number;
  qaLimit: number;
  trustProxyHops: number;
};

export function createThrottleConfig(env: ThrottleEnv = process.env): ThrottleConfig {
  return {
    ttlMs: THROTTLE_WINDOW_MS,
    globalLimit: readInteger(env.THROTTLE_LIMIT_PER_MINUTE, 120, 1),
    loginLimit: readInteger(env.THROTTLE_LOGIN_LIMIT_PER_MINUTE, 10, 1),
    qaLimit: readInteger(env.THROTTLE_QA_LIMIT_PER_MINUTE, 30, 1),
    trustProxyHops: readInteger(env.TRUST_PROXY_HOPS, 0, 0)
  };
}

function readInteger(rawValue: string | undefined, fallback: number, minimum: number): number {
  if (!rawValue?.trim()) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}
```

- [ ] **Step 4: Make `AppModule` consume the validated global configuration**

In `apps/backend/src/app.module.ts`, import `createThrottleConfig`, declare `const throttleConfig = createThrottleConfig();` before `@Module`, and replace the inline values with:

```typescript
ThrottlerModule.forRoot([
  {
    ttl: throttleConfig.ttlMs,
    limit: throttleConfig.globalLimit
  }
])
```

- [ ] **Step 5: Run focused verification and commit**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/throttle.config.spec.ts
pnpm --filter pas-backend typecheck
```

Expected: three tests PASS and typecheck exits `0`.

Commit:

```powershell
git add -- apps/backend/src/throttle.config.ts apps/backend/src/throttle.config.spec.ts apps/backend/src/app.module.ts
git commit -m "fix: validate throttle configuration"
```

---

### Task 2: Endpoint Limits And Trusted Proxy Identity

**Files:**
- Create: `apps/backend/src/trusted-proxy.ts`
- Create: `apps/backend/src/trusted-proxy.spec.ts`
- Create: `apps/backend/src/throttle.decorators.spec.ts`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/auth/auth.controller.ts`
- Modify: `apps/backend/src/qa/qa.controller.ts`

**Interfaces:**
- Consumes: `createThrottleConfig()` from Task 1.
- Produces: `configureTrustProxy(target: TrustProxyTarget, hops: number): void`.
- Produces: default throttler metadata `10/60_000` on `AuthController.login` and `30/60_000` on `QaController.ask`.

- [ ] **Step 1: Write the failing trusted-proxy tests**

Create `apps/backend/src/trusted-proxy.spec.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { configureTrustProxy } from "./trusted-proxy";

describe("configureTrustProxy", () => {
  it("does not trust forwarded headers when hops are zero", () => {
    const set = vi.fn();

    configureTrustProxy({ set }, 0);

    expect(set).not.toHaveBeenCalled();
  });

  it("sets the configured trusted proxy hop count", () => {
    const set = vi.fn();

    configureTrustProxy({ set }, 2);

    expect(set).toHaveBeenCalledWith("trust proxy", 2);
  });
});
```

- [ ] **Step 2: Run the proxy test and verify RED**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/trusted-proxy.spec.ts
```

Expected: FAIL because `./trusted-proxy` does not exist.

- [ ] **Step 3: Implement trusted-proxy configuration and wire bootstrap**

Create `apps/backend/src/trusted-proxy.ts`:

```typescript
type TrustProxyTarget = {
  set(setting: "trust proxy", value: number): unknown;
};

export function configureTrustProxy(target: TrustProxyTarget, hops: number): void {
  if (hops === 0) {
    return;
  }

  target.set("trust proxy", hops);
}
```

In `apps/backend/src/main.ts`, import `createThrottleConfig` and `configureTrustProxy`. Immediately after `NestFactory.create(AppModule)`, add:

```typescript
configureTrustProxy(app.getHttpAdapter().getInstance(), createThrottleConfig().trustProxyHops);
```

- [ ] **Step 4: Run the proxy test and verify GREEN**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/trusted-proxy.spec.ts
```

Expected: two tests PASS.

- [ ] **Step 5: Write failing endpoint metadata tests**

Create `apps/backend/src/throttle.decorators.spec.ts`:

```typescript
import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envKeys = ["THROTTLE_LOGIN_LIMIT_PER_MINUTE", "THROTTLE_QA_LIMIT_PER_MINUTE"] as const;
const previousEnv = new Map<string, string | undefined>();
const LIMIT_METADATA = "THROTTLER:LIMITdefault";
const TTL_METADATA = "THROTTLER:TTLdefault";

describe("endpoint throttle metadata", () => {
  beforeEach(() => {
    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of envKeys) {
      const previous = previousEnv.get(key);
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
    previousEnv.clear();
  });

  it("applies stricter defaults to login and QA", async () => {
    const metadata = await loadMetadata();

    expect(metadata).toEqual({ loginLimit: 10, loginTtl: 60_000, qaLimit: 30, qaTtl: 60_000 });
  });

  it("applies configured endpoint limits", async () => {
    process.env.THROTTLE_LOGIN_LIMIT_PER_MINUTE = "7";
    process.env.THROTTLE_QA_LIMIT_PER_MINUTE = "12";

    const metadata = await loadMetadata();

    expect(metadata).toEqual({ loginLimit: 7, loginTtl: 60_000, qaLimit: 12, qaTtl: 60_000 });
  });
});

async function loadMetadata(): Promise<Record<string, number>> {
  const [{ AuthController }, { QaController }] = await Promise.all([
    import("./auth/auth.controller"),
    import("./qa/qa.controller")
  ]);

  return {
    loginLimit: Reflect.getMetadata(LIMIT_METADATA, AuthController.prototype.login),
    loginTtl: Reflect.getMetadata(TTL_METADATA, AuthController.prototype.login),
    qaLimit: Reflect.getMetadata(LIMIT_METADATA, QaController.prototype.ask),
    qaTtl: Reflect.getMetadata(TTL_METADATA, QaController.prototype.ask)
  };
}
```

- [ ] **Step 6: Run the metadata test and verify RED**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/throttle.decorators.spec.ts
```

Expected: FAIL because the four metadata values are `undefined`.

- [ ] **Step 7: Apply endpoint decorators**

In both controllers, import `Throttle` from `@nestjs/throttler` and `createThrottleConfig` from `../throttle.config`, then create one module-level configuration value:

```typescript
const throttleConfig = createThrottleConfig();
```

Decorate `AuthController.login`:

```typescript
@Throttle({ default: { limit: throttleConfig.loginLimit, ttl: throttleConfig.ttlMs } })
@Post("api/auth/login")
```

Decorate `QaController.ask`:

```typescript
@Throttle({ default: { limit: throttleConfig.qaLimit, ttl: throttleConfig.ttlMs } })
@Post("ask")
```

- [ ] **Step 8: Run focused verification and commit**

Run:

```powershell
pnpm --filter pas-backend exec vitest run src/trusted-proxy.spec.ts src/throttle.decorators.spec.ts
pnpm --filter pas-backend typecheck
```

Expected: four tests PASS and typecheck exits `0`.

Commit:

```powershell
git add -- apps/backend/src/trusted-proxy.ts apps/backend/src/trusted-proxy.spec.ts apps/backend/src/throttle.decorators.spec.ts apps/backend/src/main.ts apps/backend/src/auth/auth.controller.ts apps/backend/src/qa/qa.controller.ts
git commit -m "fix: add endpoint rate limits"
```

---

### Task 3: Deployment Contract And Review Closeout

**Files:**
- Modify: `scripts/verify-compose.mjs`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docs/deployment/v0-sop.md`
- Modify: `docs/deployment/v1-sop.md`
- Modify: `docs/superpowers/plans/review-remediation-status-2026-07-09.md`

**Interfaces:**
- Consumes: the four environment variables parsed by `createThrottleConfig`.
- Produces: Compose defaults `120`, `10`, `30`, and `1`; release SOP value `TRUST_PROXY_HOPS=2` for a separate TLS terminator.

- [ ] **Step 1: Extend the deployment contract check first**

Replace the single `COOKIE_SECURE` assertion in `scripts/verify-compose.mjs` with:

```javascript
const requiredBackendEnvironmentDefaults = [
  { name: "COOKIE_SECURE", value: "true" },
  { name: "THROTTLE_LOGIN_LIMIT_PER_MINUTE", value: "10" },
  { name: "THROTTLE_QA_LIMIT_PER_MINUTE", value: "30" },
  { name: "TRUST_PROXY_HOPS", value: "1" }
];

for (const { name, value } of requiredBackendEnvironmentDefaults) {
  const pattern = new RegExp(`${name}:\\s+\\$\\{${name}:-${value}\\}`);
  if (!pattern.test(composeContent)) {
    console.error(`Expected backend compose environment to default ${name}=${value}.`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Run Compose validation and verify RED**

Run:

```powershell
pnpm compose:config
```

Expected: FAIL first on missing `THROTTLE_LOGIN_LIMIT_PER_MINUTE=10`.

- [ ] **Step 3: Expose the endpoint and proxy configuration**

In `docker-compose.yml`, add under `THROTTLE_LIMIT_PER_MINUTE`:

```yaml
THROTTLE_LOGIN_LIMIT_PER_MINUTE: ${THROTTLE_LOGIN_LIMIT_PER_MINUTE:-10}
THROTTLE_QA_LIMIT_PER_MINUTE: ${THROTTLE_QA_LIMIT_PER_MINUTE:-30}
TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}
```

In `.env.example`, add:

```text
THROTTLE_LOGIN_LIMIT_PER_MINUTE=10
THROTTLE_QA_LIMIT_PER_MINUTE=30
# Set to 2 only when a separate TLS terminator is in front of pas-frontend.
TRUST_PROXY_HOPS=1
```

- [ ] **Step 4: Document the release topology and close review item #9**

Update `docs/deployment/v0-sop.md` and `docs/deployment/v1-sop.md` to state:

```text
Local frontend-only proxy: TRUST_PROXY_HOPS=1
Release with a separate TLS terminator: TRUST_PROXY_HOPS=2
Any positive value requires pas-backend to remain private, and the value must equal the actual trusted proxy count.
```

Update review item #9 in `docs/superpowers/plans/review-remediation-status-2026-07-09.md` to:

```markdown
| 9 | Internal APIs only use bearer token, no extra protection | Fixed by `fb7f880` and endpoint rate-limit pass | Session cookies use CSRF protection; the global guard remains and login/QA now have stricter independently configurable limits with trusted proxy IP handling. |
```

- [ ] **Step 5: Run Compose verification and commit**

Run:

```powershell
pnpm compose:config
git diff --check
```

Expected: Compose validates the four PAS services and four container names; diff check exits `0`.

Commit:

```powershell
git add -- scripts/verify-compose.mjs .env.example docker-compose.yml docs/deployment/v0-sop.md docs/deployment/v1-sop.md docs/superpowers/plans/review-remediation-status-2026-07-09.md
git commit -m "fix: configure endpoint rate limits"
```

---

### Task 4: Full Regression Verification

**Files:**
- Verify only; no planned file changes.

**Interfaces:**
- Consumes: all implementation and deployment commits from Tasks 1-3.
- Produces: fresh verification evidence and a clean task-scoped worktree.

- [ ] **Step 1: Run backend regression tests**

```powershell
pnpm --filter pas-backend test
pnpm --filter pas-backend typecheck
pnpm --filter pas-backend build
```

Expected: all backend tests PASS; typecheck and build exit `0`.

- [ ] **Step 2: Run repository deployment and smoke checks**

```powershell
pnpm compose:config
pnpm test:smoke
git diff --check HEAD~3..HEAD
```

Expected: Compose contract PASS, one smoke test PASS, and no whitespace errors.

- [ ] **Step 3: Confirm commit and worktree boundaries**

```powershell
git log -4 --oneline
git status --short
```

Expected: the plan plus three implementation commits are present; only unrelated `?? design-qa.md` remains.
