import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "smoke-local-menu.mjs");

const frontendRoutes = ["/customers", "/proposals/tasks", "/exports/jobs", "/system/ai-models"];

test("smoke script verifies frontend deep links for critical pages", async () => {
  const fixture = await startSmokeServer();

  try {
    const result = await runSmoke(fixture.baseUrl);
    assert.equal(result.code, 0, result.stderr || result.stdout);
  } finally {
    await fixture.close();
  }

  for (const route of frontendRoutes) {
    assert(fixture.requests.includes(route), `expected smoke script to request frontend route ${route}`);
  }
});

test("smoke script rejects secret fields in the AI model overview", async () => {
  const fixture = await startSmokeServer({ leakModelSecret: true });
  try {
    const result = await runSmoke(fixture.baseUrl);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /leaked secret-shaped field apiKey/);
  } finally {
    await fixture.close();
  }
});

async function startSmokeServer({ leakModelSecret = false } = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push(url.pathname);

    if (frontendRoutes.includes(url.pathname) || url.pathname === "/") {
      sendHtml(response);
      return;
    }

    const body = await readBody(request);
    sendJson(response, responseFor(url, body, leakModelSecret));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    async close() {
      server.close();
      await once(server, "close");
    }
  };
}

function runSmoke(baseUrl) {
  const child = spawn(process.execPath, [scriptPath, "--base-url", baseUrl, "--username", "admin", "--password", "admin123"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolve) => {
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
  });
}

function sendHtml(response) {
  response.writeHead(200, { "content-type": "text/html" });
  response.end('<!doctype html><div id="root"></div>');
}

function sendJson(response, payload) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function responseFor(url, body, leakModelSecret) {
  switch (url.pathname) {
    case "/api/health":
      return { status: "ok" };
    case "/api/auth/login":
      assert.deepEqual(JSON.parse(body), { username: "admin", password: "admin123" });
      return { accessToken: "token", user: { username: "admin", role: "admin" } };
    case "/api/me":
      return { username: "admin", role: "admin" };
    case "/api/internal/menu/effective":
      return createEffectiveMenu();
    case "/api/internal/workbench/overview":
      return { metrics: [{ key: "active", value: 1 }], tasks: [] };
    case "/api/internal/workbench/tasks":
      return { scope: url.searchParams.get("scope") ?? "mine", tasks: [] };
    case "/api/crm/customers":
      return { customers: [{ customerId: "customer-1" }] };
    case "/api/internal/customer-analysis/analyze":
      return { status: "completed" };
    case "/api/internal/business-flows/records":
      return { records: [] };
    case "/api/internal/business-flows/metrics":
      return { definitions: [], counters: [] };
    case "/api/internal/proposals":
    case "/api/internal/exports":
    case "/api/internal/proposals/library":
    case "/api/internal/knowledge-documents":
    case "/api/internal/knowledge-blocks":
    case "/api/internal/export-templates":
    case "/api/internal/feedback":
    case "/api/internal/auth/users":
    case "/api/internal/audit/events":
      return [];
    case "/api/internal/qa/ask":
      return { status: "answered" };
    case "/api/internal/platform/dashboard":
      return { cards: [] };
    case "/api/internal/system/overview":
      return { settings: [], paths: [] };
    case "/api/internal/menu/configuration":
      return { defaults: [], overrides: [] };
    case "/api/internal/ai-models/overview":
      return {
        providers: [
          {
            provider: "bailian",
            label: "Bailian",
            defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1"
          }
        ],
        generation: {
          status: "not_configured",
          source: "mock",
          keyConfigured: false,
          timeoutSeconds: 30
        },
        ...(leakModelSecret ? { apiKey: "must-not-leak" } : {})
      };
    case "/api/internal/platform/overview":
      return { channels: [] };
    case "/api/internal/platform/security-report":
      return { totalEvents: 0 };
    case "/api/internal/platform/tenant":
      return { tenantId: "tenant-1" };
    default:
      throw new Error(`unexpected request path: ${url.pathname}`);
  }
}

function createEffectiveMenu() {
  return [
    primary("workbench", ["overview", "my_tasks", "team_tasks"]),
    primary("customers", ["customer_management", "customer_insights"]),
    primary("knowledge_delivery", ["proposal_tasks", "qa", "export_jobs", "proposal_library", "documents", "knowledge_blocks", "templates"]),
    primary("business_loop", ["opportunities", "meeting_minutes", "contracts_after_sales", "customer_feedback"]),
    primary("analytics_ops", ["analytics"]),
    primary("system", [
      "account_management",
      "audit_logs",
      "data_attachments",
      "ai_model_access",
      "secondary_menu_config",
      "system_settings",
      "platform_governance"
    ])
  ];
}

function primary(key, children) {
  return {
    key,
    children: children.map((child) => ({ key: child, route: routeFor(child) }))
  };
}

function routeFor(key) {
  return {
    customer_management: "/customers",
    proposal_tasks: "/proposals/tasks",
    export_jobs: "/exports/jobs",
    ai_model_access: "/system/ai-models"
  }[key] ?? `/${key}`;
}
