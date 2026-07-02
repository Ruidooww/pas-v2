import { describe, expect, it } from "vitest";
import { QaAuditLogService } from "./qa-audit-log.service";

describe("QaAuditLogService", () => {
  it("records QA lifecycle events without storing raw answers or secrets", () => {
    const auditLog = new QaAuditLogService();

    auditLog.record({
      event: "qa_answer_generated",
      questionId: "qa-1",
      userId: "user-1",
      status: "answered",
      citationCount: 2
    });

    expect(auditLog.list()).toEqual([
      expect.objectContaining({
        event: "qa_answer_generated",
        questionId: "qa-1",
        userId: "user-1",
        status: "answered",
        citationCount: 2
      })
    ]);
    expect(JSON.stringify(auditLog.list())).not.toContain("Bearer");
  });
});
