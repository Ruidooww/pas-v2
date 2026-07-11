import type { AuditLogService } from "../audit/audit-log.service";
import {
  modelElapsedMs,
  modelErrorCode,
  recordLlmGeneration
} from "../llm/llm-generation-audit";
import type { LlmClientPort } from "../llm/llm.types";
import type {
  ProposalBuildContext,
  ProposalDraft,
  ProposalDraftProvider,
  ProposalDraftSection
} from "./proposal.types";

const MAX_SECTION_BODY_LENGTH = 10_000;

export class ModelProposalDraftProvider implements ProposalDraftProvider {
  constructor(
    private readonly llm: LlmClientPort,
    private readonly fallback: ProposalDraftProvider,
    private readonly audit: AuditLogService,
    private readonly now: () => number = () => Date.now()
  ) {}

  async generateDraft(context: ProposalBuildContext): Promise<ProposalDraft> {
    const deterministic = await this.fallback.generateDraft(context);
    const startedAt = this.now();

    try {
      const completion = await this.llm.complete({
        system:
          "Rewrite only the section body text supplied as data. Return strict JSON in the form {\"sections\":[{\"sectionId\":\"...\",\"body\":\"...\"}]}. Keep every sectionId exactly once and do not add sections.",
        prompt: JSON.stringify({
          sections: deterministic.sections.map(({ sectionId, title, body }) => ({ sectionId, title, body }))
        }),
        temperature: 0.2,
        maxTokens: 4_000
      });

      if (completion.mode !== "real") {
        recordLlmGeneration(this.audit, {
          actorUserId: context.request.userId,
          feature: "proposal",
          provider: completion.provider,
          model: completion.model,
          elapsedMs: modelElapsedMs(startedAt, this.now()),
          result: "failure",
          fallbackUsed: true
        });
        return deterministic;
      }

      const bodies = parseSectionBodies(completion.content, deterministic.sections);
      if (!bodies) {
        recordLlmGeneration(this.audit, {
          actorUserId: context.request.userId,
          feature: "proposal",
          provider: completion.provider,
          model: completion.model,
          elapsedMs: modelElapsedMs(startedAt, this.now()),
          result: "failure",
          fallbackUsed: true,
          errorCode: "MODEL_RESPONSE_INVALID"
        });
        return deterministic;
      }

      recordLlmGeneration(this.audit, {
        actorUserId: context.request.userId,
        feature: "proposal",
        provider: completion.provider,
        model: completion.model,
        elapsedMs: modelElapsedMs(startedAt, this.now()),
        result: "success",
        fallbackUsed: false
      });
      return {
        ...deterministic,
        sections: deterministic.sections.map((section) => ({
          ...section,
          body: bodies.get(section.sectionId)!
        }))
      };
    } catch (error) {
      const errorCode = modelErrorCode(error);
      recordLlmGeneration(this.audit, {
        actorUserId: context.request.userId,
        feature: "proposal",
        elapsedMs: modelElapsedMs(startedAt, this.now()),
        result: "failure",
        fallbackUsed: true,
        errorCode
      });
      return deterministic;
    }
  }
}

function parseSectionBodies(
  content: string,
  expectedSections: ProposalDraftSection[]
): Map<string, string> | undefined {
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    return undefined;
  }

  const root = isRecord(payload) ? payload : undefined;
  const sections = root?.sections;
  if (!Array.isArray(sections) || sections.length !== expectedSections.length) {
    return undefined;
  }

  const expectedIds = new Set(expectedSections.map((section) => section.sectionId));
  const bodies = new Map<string, string>();
  for (const value of sections) {
    if (!isRecord(value) || typeof value.sectionId !== "string" || typeof value.body !== "string") {
      return undefined;
    }
    const sectionId = value.sectionId;
    const body = value.body.trim();
    if (!expectedIds.has(sectionId) || bodies.has(sectionId) || !body || body.length > MAX_SECTION_BODY_LENGTH) {
      return undefined;
    }
    bodies.set(sectionId, body);
  }

  return bodies.size === expectedIds.size ? bodies : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
