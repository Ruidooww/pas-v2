import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { FeedbackService } from "./feedback.service";

describe("FeedbackService", () => {
  it("stores feedback for V0 core artifacts", () => {
    const auditLog = new AuditLogService();
    const service = new FeedbackService(auditLog);
    const user = createUser("sales");

    const feedback = service.submitFeedback(user, {
      objectType: "qa_answer",
      objectId: "qa-1",
      rating: 2,
      issueType: "citation",
      comment: "Citation does not support the answer."
    });

    expect(feedback).toEqual(
      expect.objectContaining({
        feedbackId: expect.stringMatching(/^feedback-/),
        objectType: "qa_answer",
        objectId: "qa-1",
        rating: 2,
        issueType: "citation",
        status: "open",
        createdBy: user.userId
      })
    );
    expect(auditLog.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "feedback",
          actorUserId: user.userId,
          objectId: feedback.feedbackId,
          result: "success"
        })
      ])
    );
  });

  it("allows admin and technical users to list and update feedback status", () => {
    const service = new FeedbackService(new AuditLogService());
    const submitter = createUser("sales");
    const technical = createUser("technical");
    const feedback = service.submitFeedback(submitter, {
      objectType: "proposal_draft",
      objectId: "proposal-draft-1",
      rating: 3,
      issueType: "llm",
      comment: "Needs clearer implementation plan."
    });

    const updated = service.updateStatus(technical, feedback.feedbackId, {
      status: "triaged",
      resolutionNote: "Assigned to proposal owner."
    });

    expect(service.listFeedback(technical)).toEqual([updated]);
    expect(updated).toEqual(
      expect.objectContaining({
        status: "triaged",
        handledBy: technical.userId,
        resolutionNote: "Assigned to proposal owner."
      })
    );
  });

  it("rejects sales users from listing feedback", () => {
    const service = new FeedbackService(new AuditLogService());

    expect(() => service.listFeedback(createUser("sales"))).toThrow(ForbiddenException);
  });
});

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
