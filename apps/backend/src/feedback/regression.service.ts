import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type {
  CreateRegressionRunRequest,
  RegressionFailureReason,
  RegressionGateStatus,
  RegressionReport,
  RegressionRun
} from "./feedback.types";

export class RegressionService {
  private readonly runs = new Map<string, RegressionRun>();

  constructor(private readonly auditLog: AuditLogService) {}

  createRun(user: AuthenticatedUser, request: CreateRegressionRunRequest): RegressionRun {
    assertRegressionManager(user);
    const totalCases = request.cases.length;
    const passedCases = request.cases.filter((item) => item.passed).length;
    const failedCases = totalCases - passedCases;
    const gate = calculateGate(totalCases, failedCases);
    const run: RegressionRun = {
      ...request,
      runId: createRunId(),
      totalCases,
      passedCases,
      failedCases,
      canGoLive: gate.gateStatus === "passed",
      gateStatus: gate.gateStatus,
      failureReason: gate.failureReason,
      createdBy: user.userId,
      createdAt: new Date().toISOString()
    };
    this.runs.set(run.runId, run);
    this.auditLog.record({
      action: "feedback",
      actorUserId: user.userId,
      objectType: "regression_run",
      objectId: run.runId,
      result: "success",
      failureReason: run.failureReason
    });
    return cloneRun(run);
  }

  getRun(user: AuthenticatedUser, runId: string): RegressionRun {
    assertRegressionManager(user);
    const run = this.runs.get(runId);
    if (!run) {
      throw new NotFoundException(`Regression run not found: ${runId}`);
    }

    return cloneRun(run);
  }

  getReport(user: AuthenticatedUser, runId: string): RegressionReport {
    return {
      ...this.getRun(user, runId),
      evidenceType: "regression_report"
    };
  }
}

function calculateGate(totalCases: number, failedCases: number): {
  gateStatus: RegressionGateStatus;
  failureReason?: RegressionFailureReason;
} {
  if (totalCases < 50) {
    return {
      gateStatus: "blocked",
      failureReason: "REGRESSION_QUESTION_SET_INCOMPLETE"
    };
  }

  if (failedCases > 0) {
    return {
      gateStatus: "failed",
      failureReason: "REGRESSION_CASES_FAILED"
    };
  }

  return {
    gateStatus: "passed"
  };
}

function assertRegressionManager(user: AuthenticatedUser): void {
  if (user.role !== "admin" && user.role !== "presales") {
    throw new ForbiddenException("admin or presales role is required");
  }
}

function cloneRun(run: RegressionRun): RegressionRun {
  return {
    ...run,
    cases: run.cases.map((item) => ({ ...item }))
  };
}

function createRunId(): string {
  return `regression-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
