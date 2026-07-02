import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import { ProposalJobStoreService } from "../proposal/proposal-job-store.service";
import type { ProposalJob } from "../proposal/proposal.types";
import { AuthService } from "./auth.service";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordHasher } from "./password-hasher";
import { InMemoryUserStore } from "./user-store.service";

function buildAuthService(userStore: InMemoryUserStore): AuthService {
  return new AuthService(
    userStore,
    new PasswordHasher(),
    new JwtTokenService({ secret: "test-secret", expiresInSeconds: 3600 }),
    new AuditLogService()
  );
}

describe("restart hydration safety", () => {
  it("bootstrapAdmin is idempotent when the admin was hydrated from persistence", async () => {
    const userStore = new InMemoryUserStore();
    const service = buildAuthService(userStore);

    const first = await service.bootstrapAdmin({
      username: "admin",
      password: "secret-password",
      displayName: "Admin"
    });
    // Second boot: same store already contains the admin — must not throw.
    const second = await service.bootstrapAdmin({
      username: "admin",
      password: "secret-password",
      displayName: "Admin"
    });

    expect(second.userId).toBe(first.userId);
  });

  it("seed marks hydrated running proposal jobs as failed and retryable", () => {
    const store = new ProposalJobStoreService();
    const interrupted: ProposalJob = {
      jobId: "proposal-job-interrupted",
      status: "running",
      request: { customerId: "customer-1" },
      progress: [
        { step: "accepted", status: "completed", message: "accepted", at: "2026-07-03T00:00:00.000Z" }
      ],
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    };

    store.seed([interrupted]);
    const job = store.get("proposal-job-interrupted");

    expect(job?.status).toBe("failed");
    expect(job?.failureReason).toBe("PROPOSAL_DRAFT_FAILED");
    expect(job?.progress.at(-1)?.message).toContain("restart");
  });

  it("seed keeps completed hydrated jobs untouched", () => {
    const store = new ProposalJobStoreService();
    const done: ProposalJob = {
      jobId: "proposal-job-done",
      status: "completed",
      request: { customerId: "customer-1" },
      progress: [],
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z"
    };

    store.seed([done]);
    expect(store.get("proposal-job-done")?.status).toBe("completed");
  });
});
