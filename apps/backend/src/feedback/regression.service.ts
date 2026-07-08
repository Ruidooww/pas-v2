import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { PersistenceSink } from "../persistence/persistence-sink";
import type {
  CreateRegressionRunRequest,
  RegressionCaseInput,
  RegressionFailureReason,
  RegressionGateStatus,
  RegressionReport,
  RegressionRun
} from "./feedback.types";

export class RegressionService {
  private readonly runs = new Map<string, RegressionRun>();

  constructor(
    private readonly auditLog: AuditLogService,
    private readonly sink?: PersistenceSink
  ) {}

  seed(runs: RegressionRun[]): void {
    for (const run of runs) {
      if (!this.runs.has(run.runId)) {
        this.runs.set(run.runId, cloneRun(run));
      }
    }
  }

  createRun(user: AuthenticatedUser, request: CreateRegressionRunRequest): RegressionRun {
    assertRegressionManager(user);
    const requiredCaseCount = request.requiredCaseCount ?? 50;
    const totalCases = request.cases.length;
    const passedCases = request.cases.filter((item) => item.passed).length;
    const failedCases = totalCases - passedCases;
    const gate = calculateGate(request.cases, failedCases, requiredCaseCount);
    const run: RegressionRun = {
      ...request,
      requiredCaseCount,
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
    this.sink?.mirrorRegressionRun(run);
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

function calculateGate(cases: RegressionCaseInput[], failedCases: number, requiredCaseCount: 50 | 100): {
  gateStatus: RegressionGateStatus;
  failureReason?: RegressionFailureReason;
} {
  if (cases.length < requiredCaseCount) {
    return {
      gateStatus: "blocked",
      failureReason: "REGRESSION_QUESTION_SET_INCOMPLETE"
    };
  }

  if (cases.length !== requiredCaseCount || hasInvalidCaseIdentity(cases)) {
    return {
      gateStatus: "blocked",
      failureReason: "REGRESSION_QUESTION_SET_INVALID"
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

function hasInvalidCaseIdentity(cases: RegressionCaseInput[]): boolean {
  const questionIds = new Set<string>();
  for (const item of cases) {
    const questionId = item.questionId.trim();
    if (!questionId || !item.question.trim() || !item.expectedEvidence.trim() || questionIds.has(questionId)) {
      return true;
    }
    questionIds.add(questionId);
  }
  return false;
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
