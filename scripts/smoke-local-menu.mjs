#!/usr/bin/env node

const EXPECTED_PRIMARY_KEYS = ["workbench", "customers", "knowledge_delivery", "business_loop", "analytics_ops", "system"];
const EXPECTED_SECONDARY_KEYS = [
  "overview",
  "my_tasks",
  "team_tasks",
  "customer_management",
  "customer_insights",
  "opportunities",
  "meeting_minutes",
  "contracts_after_sales",
  "proposal_tasks",
  "qa",
  "export_jobs",
  "proposal_library",
  "documents",
  "knowledge_blocks",
  "templates",
  "customer_feedback",
  "analytics",
  "account_management",
  "audit_logs",
  "data_attachments",
  "ai_model_access",
  "secondary_menu_config",
  "system_settings",
  "platform_governance"
];
const FRONTEND_ROUTE_SMOKE_KEYS = ["customer_management", "proposal_tasks", "export_jobs", "ai_model_access"];

const args = parseArgs(process.argv.slice(2));
const baseUrl = trimTrailingSlash(args.baseUrl ?? process.env.PAS_SMOKE_BASE_URL ?? "http://127.0.0.1:5174");
const username = args.username ?? process.env.PAS_SMOKE_USERNAME ?? "admin";
const password = args.password ?? process.env.PAS_SMOKE_PASSWORD ?? "admin123";

const state = {
  accessToken: "",
  user: undefined,
  firstCustomerId: undefined
};

const menuChecks = {
  overview: async () => {
    const overview = await getJson("/api/internal/workbench/overview", authHeaders());
    assert(Array.isArray(overview.metrics) && overview.metrics.length > 0, "workbench overview metrics are empty");
    assert(Array.isArray(overview.tasks), "workbench overview tasks must be an array");
  },
  my_tasks: async () => {
    const response = await getJson("/api/internal/workbench/tasks?scope=mine", authHeaders());
    assert(response.scope === "mine", "my tasks scope mismatch");
    assert(Array.isArray(response.tasks), "my tasks must be an array");
  },
  team_tasks: async () => {
    const response = await getJson("/api/internal/workbench/tasks?scope=team", authHeaders());
    assert(response.scope === "team", "team tasks scope mismatch");
    assert(Array.isArray(response.tasks), "team tasks must be an array");
  },
  customer_management: async () => {
    const response = await getJson("/api/crm/customers", authHeaders());
    assert(Array.isArray(response.customers) && response.customers.length > 0, "CRM customers are empty");
    state.firstCustomerId = response.customers[0].customerId;
  },
  customer_insights: async () => {
    await ensureCustomer();
    const response = await postJson(
      "/api/internal/customer-analysis/analyze",
      { customerId: state.firstCustomerId },
      authHeaders()
    );
    assert(response.status === "completed", "customer analysis did not complete");
  },
  opportunities: () => getJson("/api/internal/business-flows/records", authHeaders()),
  meeting_minutes: () => getJson("/api/internal/business-flows/records", authHeaders()),
  contracts_after_sales: () => getJson("/api/internal/business-flows/metrics", authHeaders()),
  proposal_tasks: async () => {
    const response = await getJson("/api/internal/proposals", authHeaders());
    assert(Array.isArray(response), "proposal task list must be an array");
  },
  qa: async () => {
    const response = await postJson(
      "/api/internal/qa/ask",
      { query: "How does IP-Guard protect outbound files?" },
      authHeaders()
    );
    assert(["answered", "no_hit"].includes(response.status), `unexpected QA status ${response.status}`);
  },
  export_jobs: async () => {
    const response = await getJson("/api/internal/exports", authHeaders());
    assert(Array.isArray(response), "export job list must be an array");
  },
  proposal_library: async () => {
    const response = await getJson("/api/internal/proposals/library", authHeaders());
    assert(Array.isArray(response), "proposal library must be an array");
  },
  documents: async () => {
    const response = await getJson("/api/internal/knowledge-documents", authHeaders());
    assert(Array.isArray(response), "knowledge document list must be an array");
  },
  knowledge_blocks: async () => {
    const response = await getJson("/api/internal/knowledge-blocks", authHeaders());
    assert(Array.isArray(response), "knowledge block list must be an array");
  },
  templates: async () => {
    const response = await getJson("/api/internal/export-templates", authHeaders());
    assert(Array.isArray(response), "template list must be an array");
  },
  customer_feedback: async () => {
    const response = await getJson("/api/internal/feedback", authHeaders());
    assert(Array.isArray(response), "feedback list must be an array");
  },
  analytics: async () => {
    const response = await getJson("/api/internal/platform/dashboard", authHeaders());
    assert(Array.isArray(response.cards), "analytics dashboard cards must be an array");
  },
  account_management: async () => {
    const response = await getJson("/api/internal/auth/users", authHeaders());
    assert(Array.isArray(response), "user list must be an array");
  },
  audit_logs: async () => {
    const response = await getJson("/api/internal/audit/events", authHeaders());
    assert(Array.isArray(response), "audit events must be an array");
  },
  data_attachments: () => checkSystemOverview(),
  ai_model_access: async () => {
    const response = await getJson("/api/internal/ai-models/overview", authHeaders());
    assert(Array.isArray(response.providers), "AI model provider presets must be an array");
    assert(Boolean(response.generation), "AI model generation overview is missing");
    assertNoSecretFields(response);
  },
  secondary_menu_config: async () => {
    const response = await getJson("/api/internal/menu/configuration", authHeaders());
    assert(Array.isArray(response.defaults), "menu configuration defaults must be an array");
    assert(Array.isArray(response.overrides), "menu configuration overrides must be an array");
  },
  system_settings: () => checkSystemOverview(),
  platform_governance: async () => {
    const overview = await getJson("/api/internal/platform/overview", authHeaders());
    const security = await getJson("/api/internal/platform/security-report", authHeaders());
    const tenant = await getJson("/api/internal/platform/tenant", authHeaders());
    assert(Array.isArray(overview.channels), "platform overview channels must be an array");
    assert(typeof security.totalEvents === "number", "security report totalEvents must be numeric");
    assert(Boolean(tenant.tenantId), "tenant reservation missing tenantId");
  }
};

await main();

async function main() {
  await checkFrontendShell("/");
  const health = await getJson("/api/health");
  assert(health.status === "ok", `health status is ${health.status}`);

  const login = await postJson("/api/auth/login", { username, password });
  assert(Boolean(login.accessToken), "login did not return an accessToken");
  state.accessToken = login.accessToken;
  state.user = login.user;

  const me = await getJson("/api/me", authHeaders());
  assert(me.username === state.user.username, "/api/me does not match login user");
  assert(me.role === "admin", "menu smoke requires an admin user");

  const menu = await getJson("/api/internal/menu/effective", authHeaders());
  const allSecondaries = menu.flatMap((primary) => primary.children.map((child) => child.key));
  assertSameSet(menu.map((primary) => primary.key), EXPECTED_PRIMARY_KEYS, "primary menu keys");
  assertSameSet(allSecondaries, EXPECTED_SECONDARY_KEYS, "secondary menu keys");
  assert(!allSecondaries.includes("product_registry"), "product_registry should not be visible");
  assert(!allSecondaries.includes("integration_health"), "integration_health should not be visible");
  assertEveryMenuHasSmokeCheck();
  await checkFrontendRoutes(menu);

  for (const key of EXPECTED_SECONDARY_KEYS) {
    await menuChecks[key]();
    console.log(`ok ${key}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        user: `${me.username}/${me.role}`,
        primaryMenus: menu.length,
        secondaryMenus: allSecondaries.length,
        frontendRoutes: FRONTEND_ROUTE_SMOKE_KEYS.length
      },
      null,
      2
    )
  );
}

async function checkFrontendRoutes(menu) {
  const routesByKey = new Map(
    menu.flatMap((primary) => primary.children.map((child) => [child.key, child.route]))
  );
  for (const key of FRONTEND_ROUTE_SMOKE_KEYS) {
    const route = routesByKey.get(key);
    assert(typeof route === "string" && route.startsWith("/"), `missing frontend route for ${key}`);
    await checkFrontendShell(route);
    console.log(`ok frontend:${route}`);
  }
}

async function checkFrontendShell(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert(response.ok, `frontend shell ${path} returned HTTP ${response.status}`);
  const html = await response.text();
  assert(html.includes("id=\"root\"") || html.includes("id='root'"), `frontend shell ${path} does not contain root mount`);
}

async function checkSystemOverview() {
  const response = await getJson("/api/internal/system/overview", authHeaders());
  assert(Array.isArray(response.settings), "system settings must be an array");
  assert(Array.isArray(response.paths), "system paths must be an array");
}

async function ensureCustomer() {
  if (state.firstCustomerId) {
    return;
  }
  await menuChecks.customer_management();
}

async function getJson(path, headers = {}) {
  return requestJson("GET", path, undefined, headers);
}

async function postJson(path, body, headers = {}) {
  return requestJson("POST", path, body, headers);
}

async function requestJson(method, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with HTTP ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : undefined;
}

function authHeaders() {
  return { authorization: `Bearer ${state.accessToken}` };
}

function assertEveryMenuHasSmokeCheck() {
  const missing = EXPECTED_SECONDARY_KEYS.filter((key) => typeof menuChecks[key] !== "function");
  assert(missing.length === 0, `missing smoke checks for menu keys: ${missing.join(", ")}`);
}

function assertSameSet(actual, expected, label) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  assert(missing.length === 0 && extra.length === 0, `${label} mismatch missing=${missing.join(",")} extra=${extra.join(",")}`);
}

function assertNoSecretFields(value) {
  const forbidden = new Set([
    "apikey",
    "apikeyauthtag",
    "apikeyiv",
    "ciphertext",
    "encryptedapikey",
    "encryptionkey"
  ]);
  visit(value);

  function visit(current) {
    if (!current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
      assert(!forbidden.has(normalizedKey), `AI model overview leaked secret-shaped field ${key}`);
      visit(child);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--base-url" && next) {
      parsed.baseUrl = next;
      index += 1;
    } else if (arg === "--username" && next) {
      parsed.username = next;
      index += 1;
    } else if (arg === "--password" && next) {
      parsed.password = next;
      index += 1;
    } else if (arg === "--help") {
      console.log("Usage: pnpm smoke:local -- --base-url http://127.0.0.1:5174 --username admin --password admin123");
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return parsed;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
