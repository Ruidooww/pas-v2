import { describe, expect, it, vi } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PersistenceSink } from "../persistence/persistence-sink";
import { RegressionService } from "./regression.service";

describe("RegressionService", () => {
  it("blocks go-live when the regression question set has fewer than 50 cases", () => {
    const service = new RegressionService(new AuditLogService());
    const run = service.createRun(createUser("technical"), {
      name: "V0 smoke regression",
      owner: "QA owner",
      approver: "Business approver",
      cases: [
        {
          questionId: "q-1",
          question: "How does IP-Guard protect outbound files?",
          expectedEvidence: "IP-Guard outbound audit evidence",
          passed: true
        }
      ]
    });

    expect(run).toEqual(
      expect.objectContaining({
        runId: expect.stringMatching(/^regression-/),
        totalCases: 1,
        passedCases: 1,
        failedCases: 0,
        canGoLive: false,
        gateStatus: "blocked",
        failureReason: "REGRESSION_QUESTION_SET_INCOMPLETE"
      })
    );
  });

  it("blocks go-live when any of 50 regression cases fails", () => {
    const service = new RegressionService(new AuditLogService());
    const cases = Array.from({ length: 50 }, (_, index) => ({
      questionId: `q-${index + 1}`,
      question: `Question ${index + 1}`,
      expectedEvidence: `Evidence ${index + 1}`,
      passed: index !== 49,
      failureReason: index === 49 ? "Missing citation" : undefined
    }));

    const run = service.createRun(createUser("admin"), {
      name: "V0 full regression",
      owner: "QA owner",
      approver: "Business approver",
      cases
    });

    expect(run.totalCases).toBe(50);
    expect(run.passedCases).toBe(49);
    expect(run.failedCases).toBe(1);
    expect(run.canGoLive).toBe(false);
    expect(run.gateStatus).toBe("failed");
    expect(run.failureReason).toBe("REGRESSION_CASES_FAILED");
  });

  it("blocks go-live when the regression question set has more than 50 cases", () => {
    const service = new RegressionService(new AuditLogService());
    const run = service.createRun(createUser("admin"), {
      name: "V0 oversized regression",
      owner: "QA owner",
      approver: "Business approver",
      cases: createPassingCases(51)
    });

    expect(run.totalCases).toBe(51);
    expect(run.canGoLive).toBe(false);
    expect(run.gateStatus).toBe("blocked");
    expect(run.failureReason).toBe("REGRESSION_QUESTION_SET_INVALID");
  });

  it("blocks go-live when regression question ids are duplicated", () => {
    const service = new RegressionService(new AuditLogService());
    const cases = createPassingCases(50);
    const lastCase = cases[49];
    if (!lastCase) {
      throw new Error("test setup expected 50 cases");
    }
    cases[49] = {
      ...lastCase,
      questionId: "q-1"
    };

    const run = service.createRun(createUser("admin"), {
      name: "V0 duplicate regression",
      owner: "QA owner",
      approver: "Business approver",
      cases
    });

    expect(run.totalCases).toBe(50);
    expect(run.canGoLive).toBe(false);
    expect(run.gateStatus).toBe("blocked");
    expect(run.failureReason).toBe("REGRESSION_QUESTION_SET_INVALID");
  });

  it("produces an acceptance report when all 50 cases pass", () => {
    const service = new RegressionService(new AuditLogService());
    const run = service.createRun(createUser("admin"), {
      name: "V0 full regression",
      owner: "QA owner",
      approver: "Business approver",
      cases: createPassingCases(50)
    });

    const report = service.getReport(createUser("technical"), run.runId);

    expect(report).toEqual(
      expect.objectContaining({
        runId: run.runId,
        canGoLive: true,
        gateStatus: "passed",
        evidenceType: "regression_report"
      })
    );
  });

  it("mirrors and hydrates regression runs through the persistence sink", () => {
    const sink = {
      mirrorRegressionRun: vi.fn()
    } as unknown as PersistenceSink;
    const service = new RegressionService(new AuditLogService(), sink);
    const run = service.createRun(createUser("admin"), {
      name: "V0 full regression",
      owner: "QA owner",
      approver: "Business approver",
      cases: createPassingCases(50)
    });

    expect(sink.mirrorRegressionRun).toHaveBeenCalledWith(run);

    const hydrated = new RegressionService(new AuditLogService());
    hydrated.seed([run]);

    expect(hydrated.getReport(createUser("technical"), run.runId)).toEqual(
      expect.objectContaining({
        runId: run.runId,
        evidenceType: "regression_report"
      })
    );
  });

  it("blocks V1 go-live when the declared 100-question gate receives only 50 cases", () => {
    const service = new RegressionService(new AuditLogService());
    const run = service.createRun(createUser("admin"), {
      name: "V1 100-question regression",
      owner: "QA owner",
      approver: "Business approver",
      requiredCaseCount: 100,
      cases: createPassingCases(50)
    });

    expect(run.requiredCaseCount).toBe(100);
    expect(run.totalCases).toBe(50);
    expect(run.canGoLive).toBe(false);
    expect(run.gateStatus).toBe("blocked");
    expect(run.failureReason).toBe("REGRESSION_QUESTION_SET_INCOMPLETE");
  });

  it("passes V1 go-live when all declared 100 regression cases pass", () => {
    const service = new RegressionService(new AuditLogService());
    const run = service.createRun(createUser("admin"), {
      name: "V1 100-question regression",
      owner: "QA owner",
      approver: "Business approver",
      requiredCaseCount: 100,
      cases: createPassingCases(100)
    });

    expect(run.requiredCaseCount).toBe(100);
    expect(run.totalCases).toBe(100);
    expect(run.passedCases).toBe(100);
    expect(run.canGoLive).toBe(true);
    expect(run.gateStatus).toBe("passed");
    expect(run.failureReason).toBeUndefined();
  });
});

function createPassingCases(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `q-${index + 1}`,
    question: `Question ${index + 1}`,
    expectedEvidence: `Evidence ${index + 1}`,
    passed: true
  }));
}

function createUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    userId: `${role}-1`,
    username: `${role}@example.com`,
    displayName: role,
    role,
    organizationUnitId: role === "sales" ? "org-sales" : role === "technical" ? "org-technical-presales" : "org-company",
    projectGroupIds: []
  };
}
