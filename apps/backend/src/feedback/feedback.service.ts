import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { FeedbackRecord, SubmitFeedbackRequest, UpdateFeedbackStatusRequest } from "./feedback.types";

export class FeedbackService {
  private readonly feedback = new Map<string, FeedbackRecord>();

  constructor(private readonly auditLog: AuditLogService) {}

  submitFeedback(user: AuthenticatedUser, request: SubmitFeedbackRequest): FeedbackRecord {
    const record: FeedbackRecord = {
      ...request,
      feedbackId: createFeedbackId(),
      status: "open",
      createdBy: user.userId,
      createdAt: new Date().toISOString()
    };
    this.feedback.set(record.feedbackId, record);
    this.auditLog.record({
      action: "feedback",
      actorUserId: user.userId,
      objectType: request.objectType,
      objectId: record.feedbackId,
      result: "success"
    });
    return cloneFeedback(record);
  }

  listFeedback(user: AuthenticatedUser): FeedbackRecord[] {
    assertFeedbackManager(user);
    return [...this.feedback.values()].map(cloneFeedback);
  }

  updateStatus(
    user: AuthenticatedUser,
    feedbackId: string,
    request: UpdateFeedbackStatusRequest
  ): FeedbackRecord {
    assertFeedbackManager(user);
    const existing = this.feedback.get(feedbackId);
    if (!existing) {
      throw new NotFoundException(`Feedback not found: ${feedbackId}`);
    }

    const updated: FeedbackRecord = {
      ...existing,
      status: request.status,
      handledBy: user.userId,
      handledAt: new Date().toISOString(),
      resolutionNote: request.resolutionNote
    };
    this.feedback.set(feedbackId, updated);
    this.auditLog.record({
      action: "feedback",
      actorUserId: user.userId,
      objectType: existing.objectType,
      objectId: feedbackId,
      result: "success"
    });
    return cloneFeedback(updated);
  }
}

function assertFeedbackManager(user: AuthenticatedUser): void {
  if (user.role !== "admin" && user.role !== "presales") {
    throw new ForbiddenException("admin or presales role is required");
  }
}

function cloneFeedback(record: FeedbackRecord): FeedbackRecord {
  return { ...record };
}

function createFeedbackId(): string {
  return `feedback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
