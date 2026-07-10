import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import { OrganizationService } from "../organization/organization.service";
import { OrganizationStoreService } from "../organization/organization-store.service";
import { DEFAULT_ORGANIZATION_UNIT_IDS, createDefaultOrganizationState } from "../organization/organization.types";
import { ProposalJobStoreService } from "../proposal/proposal-job-store.service";
import type { ProposalJob } from "../proposal/proposal.types";
import { AuthService } from "./auth.service";
import { JwtTokenService } from "./jwt-token.service";
import { PasswordHasher } from "./password-hasher";
import { InMemoryUserStore } from "./user-store.service";

function buildAuthService(userStore: InMemoryUserStore): AuthService {
  const auditLog = new AuditLogService();
  const organizationStore = new OrganizationStoreService();
  organizationStore.seed(createDefaultOrganizationState("2026-07-10T00:00:00.000Z"));
  return new AuthService(
    userStore,
    new PasswordHasher(),
    new JwtTokenService({ secret: "test-secret", expiresInSeconds: 3600 }),
    auditLog,
    new OrganizationService(organizationStore, auditLog)
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

  it("normalizes hydrated presales users into the technical presales team", () => {
    const userStore = new InMemoryUserStore();
    userStore.seed([
      {
        userId: "legacy-presales-1",
        username: "legacy@example.com",
        displayName: "Legacy Presales",
        role: "presales",
        passwordHash: "hash",
        active: true,
        createdAt: "2026-07-01T00:00:00.000Z"
      } as never
    ]);

    expect(userStore.findById("legacy-presales-1")).toEqual(
      expect.objectContaining({
        role: "technical",
        organizationUnitId: DEFAULT_ORGANIZATION_UNIT_IDS.technicalPresales,
        projectGroupIds: []
      })
    );
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
