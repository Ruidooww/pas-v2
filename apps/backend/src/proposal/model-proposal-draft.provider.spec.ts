import { describe, expect, it, vi } from "vitest";
import { AuditLogService } from "../audit/audit-log.service";
import { LlmRequestError } from "../llm/llm.errors";
import type { LlmClientPort } from "../llm/llm.types";
import { ModelProposalDraftProvider } from "./model-proposal-draft.provider";
import type { ProposalBuildContext, ProposalDraft, ProposalDraftProvider } from "./proposal.types";

describe("ModelProposalDraftProvider", () => {
  it("replaces only known section bodies from a valid real-model response", async () => {
    const deterministic = createDraft();
    const fallback = createFallback(deterministic);
    const llm = createLlm(
      JSON.stringify({
        sections: [
          { sectionId: "executive-summary", body: "Model executive body" },
          { sectionId: "recommended-solution", body: "Model solution body" }
        ]
      })
    );
    const audit = new AuditLogService();
    const provider = new ModelProposalDraftProvider(llm, fallback, audit);

    const result = await provider.generateDraft(createContext());

    expect(result).toEqual({
      ...deterministic,
      sections: [
        { ...deterministic.sections[0], body: "Model executive body" },
        { ...deterministic.sections[1], body: "Model solution body" }
      ]
    });
    expect(result.citations).toBe(deterministic.citations);
    expect(result.assumptions).toBe(deterministic.assumptions);
    expect(result.reviewRequired).toBe(true);
    expect(result.sections[0]?.traces).toBe(deterministic.sections[0]?.traces);

    const request = vi.mocked(llm.complete).mock.calls[0]?.[0];
    expect(JSON.parse(request?.prompt ?? "{}")).toEqual({
      sections: deterministic.sections.map(({ sectionId, title, body }) => ({ sectionId, title, body }))
    });
    expect(request?.prompt).not.toContain("chunk-1");
    expect(audit.list()).toEqual([
      expect.objectContaining({
        action: "llm_generation",
        actorUserId: "user-1",
        result: "success",
        metadata: expect.objectContaining({ feature: "proposal", fallbackUsed: false })
      })
    ]);
  });

  it.each([
    ["malformed JSON", "not-json"],
    [
      "missing section",
      JSON.stringify({ sections: [{ sectionId: "executive-summary", body: "Only one" }] })
    ],
    [
      "unknown section",
      JSON.stringify({
        sections: [
          { sectionId: "executive-summary", body: "A" },
          { sectionId: "unknown", body: "B" }
        ]
      })
    ],
    [
      "duplicate section",
      JSON.stringify({
        sections: [
          { sectionId: "executive-summary", body: "A" },
          { sectionId: "executive-summary", body: "B" }
        ]
      })
    ],
    [
      "blank body",
      JSON.stringify({
        sections: [
          { sectionId: "executive-summary", body: "A" },
          { sectionId: "recommended-solution", body: "   " }
        ]
      })
    ],
    [
      "oversized body",
      JSON.stringify({
        sections: [
          { sectionId: "executive-summary", body: "A" },
          { sectionId: "recommended-solution", body: "x".repeat(10_001) }
        ]
      })
    ]
  ])("uses the whole deterministic draft for %s", async (_name, content) => {
    const deterministic = createDraft();
    const audit = new AuditLogService();
    const provider = new ModelProposalDraftProvider(createLlm(content), createFallback(deterministic), audit);

    await expect(provider.generateDraft(createContext())).resolves.toBe(deterministic);
    expect(audit.list()[0]).toEqual(
      expect.objectContaining({
        action: "llm_generation",
        result: "failure",
        failureReason: "MODEL_RESPONSE_INVALID",
        metadata: expect.objectContaining({ feature: "proposal", fallbackUsed: true })
      })
    );
  });

  it("uses the deterministic draft for mock mode and provider failures", async () => {
    const deterministic = createDraft();
    const mockLlm: LlmClientPort = {
      complete: vi.fn().mockResolvedValue({ content: "mock", model: "mock", mode: "mock", source: "mock" })
    };
    const failedLlm: LlmClientPort = {
      complete: vi.fn().mockRejectedValue(new LlmRequestError("MODEL_RATE_LIMITED", "rate limited"))
    };

    await expect(
      new ModelProposalDraftProvider(mockLlm, createFallback(deterministic), new AuditLogService()).generateDraft(
        createContext()
      )
    ).resolves.toBe(deterministic);
    await expect(
      new ModelProposalDraftProvider(failedLlm, createFallback(deterministic), new AuditLogService()).generateDraft(
        createContext()
      )
    ).resolves.toBe(deterministic);
  });
});

function createLlm(content: string): LlmClientPort {
  return {
    complete: vi.fn().mockResolvedValue({
      content,
      model: "qwen-plus",
      mode: "real",
      provider: "bailian",
      source: "database"
    })
  };
}

function createFallback(draft: ProposalDraft): ProposalDraftProvider {
  return { generateDraft: vi.fn().mockResolvedValue(draft) };
}

function createContext(): ProposalBuildContext {
  return {
    analysis: {
      analysisId: "ca-1",
      status: "completed",
      customerId: "customer-1",
      customerName: "Huaxin Precision",
      painPoints: [],
      risks: [],
      entryAngles: [],
      recommendedCapabilities: [],
      evidence: []
    },
    request: { customerId: "customer-1", userId: "user-1" }
  };
}

function createDraft(): ProposalDraft {
  return {
    draftId: "draft-1",
    customerId: "customer-1",
    customerName: "Huaxin Precision",
    title: "Proposal",
    reviewRequired: true,
    generatedAt: "2026-07-11T00:00:00.000Z",
    sections: [
      {
        sectionId: "executive-summary",
        title: "Executive summary",
        body: "Deterministic executive body",
        traces: [{ source: "human_input", inputId: "analysis-1", label: "Analysis", note: "fixed" }]
      },
      {
        sectionId: "recommended-solution",
        title: "Recommended solution",
        body: "Deterministic solution body",
        traces: [{ source: "citation", chunkId: "chunk-1", label: "Manual", note: "fixed" }]
      }
    ],
    citations: [
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        title: "Manual",
        source: "manual.pdf",
        score: 0.9
      }
    ],
    assumptions: ["Human review required"]
  };
}
