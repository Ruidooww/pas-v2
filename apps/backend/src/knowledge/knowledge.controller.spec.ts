import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../auth/auth.types";
import { KnowledgeBlockController } from "./knowledge.controller";
import type { KnowledgeBlockService } from "./knowledge.service";
import type { CreateKnowledgeBlockRequest } from "./knowledge.types";

const request = {
  user: createUser("technical")
};

describe("KnowledgeBlockController", () => {
  it("creates a draft using the authenticated user", () => {
    const block = { blockId: "kb-1", status: "draft" };
    const service = {
      createDraft: vi.fn().mockReturnValue(block)
    } as unknown as KnowledgeBlockService;
    const controller = new KnowledgeBlockController(service);
    const body = createRequest();

    expect(controller.create(request, body)).toBe(block);
    expect(service.createDraft).toHaveBeenCalledWith(request.user, body);
  });

  it("lists blocks with status and published-only filters", () => {
    const blocks = [{ blockId: "kb-1", status: "published" }];
    const service = {
      listBlocks: vi.fn().mockReturnValue(blocks)
    } as unknown as KnowledgeBlockService;
    const controller = new KnowledgeBlockController(service);

    expect(controller.list(request, { status: "published", publishedOnly: "true" })).toBe(blocks);
    expect(service.listBlocks).toHaveBeenCalledWith(request.user, {
      status: "published",
      publishedOnly: true
    });
  });

  it("delegates get, submit-review, review, disable, and published list operations", () => {
    const block = { blockId: "kb-1", status: "published" };
    const service = {
      getBlock: vi.fn().mockReturnValue(block),
      submitForReview: vi.fn().mockReturnValue(block),
      reviewBlock: vi.fn().mockReturnValue(block),
      disableBlock: vi.fn().mockReturnValue(block),
      listPublishedBlocks: vi.fn().mockReturnValue([block])
    } as unknown as KnowledgeBlockService;
    const controller = new KnowledgeBlockController(service);

    expect(controller.get(request, "kb-1")).toBe(block);
    expect(controller.submitReview(request, "kb-1")).toBe(block);
    expect(controller.review(createRequestWithUser("admin"), "kb-1", { decision: "approve" })).toBe(block);
    expect(controller.disable(createRequestWithUser("admin"), "kb-1", { reviewNote: "obsolete" })).toBe(block);
    expect(controller.listPublished()).toEqual([block]);
    expect(service.getBlock).toHaveBeenCalledWith(request.user, "kb-1");
    expect(service.submitForReview).toHaveBeenCalledWith(request.user, "kb-1");
    expect(service.reviewBlock).toHaveBeenCalledWith(createUser("admin"), "kb-1", { decision: "approve" });
    expect(service.disableBlock).toHaveBeenCalledWith(createUser("admin"), "kb-1", "obsolete");
    expect(service.listPublishedBlocks).toHaveBeenCalled();
  });
});

function createRequest(): CreateKnowledgeBlockRequest {
  return {
    title: "IP-Guard outbound control",
    product: "IP-Guard",
    scenario: "outbound",
    body: "IP-Guard can audit and control outbound files."
  };
}

function createRequestWithUser(role: AuthenticatedUser["role"]) {
  return {
    user: createUser(role)
  };
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
