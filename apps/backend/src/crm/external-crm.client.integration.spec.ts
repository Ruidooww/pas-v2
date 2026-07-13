import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { ExternalCrmClient } from "./external-crm.client";

describe("ExternalCrmClient native HTTP transport", () => {
  it("uses only GET against a real HTTP transport", async () => {
    const requests: Array<{ method: string; url: string; authorization: string }> = [];
    const server = createServer((request, response) => {
      requests.push({
        method: request.method || "",
        url: request.url || "",
        authorization: request.headers.authorization || ""
      });
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(
          request.url === "/users/options"
            ? { data: [{ id: "user-1", name: "Alice" }] }
            : {
                data: [
                  {
                    id: "customer-1",
                    name: "Acme",
                    industry: "Manufacturing",
                    region: "East",
                    ownerId: "user-1"
                  }
                ],
                meta: { totalPages: 1 }
              }
        )
      );
    });
    await listen(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");

    try {
      const client = new ExternalCrmClient({
        clientMode: "external",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiToken: "test-token",
        timeoutMs: 10000
      });

      await expect(client.listCustomers()).resolves.toHaveLength(1);
      expect(requests).toHaveLength(2);
      expect(requests.map(({ method, url }) => ({ method, url })).sort(byUrl)).toEqual([
        { method: "GET", url: "/customers?page=1&pageSize=100" },
        { method: "GET", url: "/users/options" }
      ]);
      expect(requests.every(({ authorization }) => authorization === "Bearer test-token")).toBe(true);
    } finally {
      await close(server);
    }
  });

  it("uses the exact read-only customer-context endpoints", async () => {
    const requests: Array<{ method: string; url: string; authorization: string }> = [];
    const server = createServer((request, response) => {
      const method = request.method || "";
      const url = request.url || "";
      requests.push({ method, url, authorization: request.headers.authorization || "" });
      response.setHeader("Content-Type", "application/json");

      if (url === "/customers/customer-1") {
        response.end(JSON.stringify({ data: { id: "customer-1", name: "Acme" } }));
        return;
      }
      if (url === "/users/options" || url === "/customers/customer-1/contacts") {
        response.end(JSON.stringify({ data: [] }));
        return;
      }
      if (
        url === "/customers/customer-1/followups?page=1&pageSize=100" ||
        url === "/opportunities?customerId=customer-1&page=1&pageSize=100"
      ) {
        response.end(JSON.stringify({ data: [], meta: { totalPages: 1 } }));
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({}));
    });
    await listen(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");

    try {
      const client = new ExternalCrmClient({
        clientMode: "external",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiToken: "test-token",
        timeoutMs: 10000
      });

      await expect(client.getCustomerContext("customer-1")).resolves.toMatchObject({
        customerId: "customer-1"
      });
      expect(requests).toHaveLength(5);
      expect(requests.map(({ method, url }) => ({ method, url })).sort(byUrl)).toEqual(
        [
          { method: "GET", url: "/customers/customer-1" },
          { method: "GET", url: "/customers/customer-1/contacts" },
          { method: "GET", url: "/customers/customer-1/followups?page=1&pageSize=100" },
          { method: "GET", url: "/opportunities?customerId=customer-1&page=1&pageSize=100" },
          { method: "GET", url: "/users/options" }
        ].sort(byUrl)
      );
      expect(requests.every(({ authorization }) => authorization === "Bearer test-token")).toBe(true);
    } finally {
      await close(server);
    }
  });
});

function byUrl(left: { url: string }, right: { url: string }): number {
  return left.url.localeCompare(right.url);
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
