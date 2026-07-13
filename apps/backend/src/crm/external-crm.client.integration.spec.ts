import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { ExternalCrmClient } from "./external-crm.client";

describe("ExternalCrmClient native HTTP transport", () => {
  it("uses only GET against a real HTTP transport", async () => {
    const methods: string[] = [];
    const server = createServer((request, response) => {
      methods.push(request.method || "");
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
      expect(methods).toEqual(["GET", "GET"]);
    } finally {
      await close(server);
    }
  });
});

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
