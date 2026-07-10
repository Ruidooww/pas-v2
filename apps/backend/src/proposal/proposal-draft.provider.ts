import type {
  AnalysisBasis,
  CustomerAnalysisItem,
  CustomerAnalysisResult
} from "../customer-analysis/customer-analysis.types";
import { createPrefixedId } from "../ids";
import type {
  ProposalBuildContext,
  ProposalDraft,
  ProposalDraftSection,
  ProposalGenerationRequest,
  ProposalTrace
} from "./proposal.types";

export class LocalProposalDraftProvider {
  async generateDraft(context: ProposalBuildContext): Promise<ProposalDraft> {
    const { analysis, request } = context;
    const sections: ProposalDraftSection[] = [
      buildExecutiveSummary(analysis),
      buildItemSection("business-pain-points", "Business pain points", analysis.painPoints, analysis),
      buildItemSection("recommended-solution", "Recommended IP-Guard solution", analysis.recommendedCapabilities, analysis),
      buildItemSection("implementation-plan", "Implementation approach", analysis.entryAngles, analysis),
      buildItemSection("risks-and-assumptions", "Risks and assumptions", analysis.risks, analysis)
    ];

    if (request.humanInputs?.length) {
      sections.push(buildHumanInputsSection(request.humanInputs));
    }

    return {
      draftId: createDraftId(),
      customerId: analysis.customerId,
      customerName: analysis.customerName,
      title: `${analysis.customerName} IP-Guard proposal draft`,
      reviewRequired: true,
      generatedAt: new Date().toISOString(),
      sections,
      citations: analysis.evidence,
      assumptions: [
        "V0 proposal output is a reviewable draft and must be checked by the technical team before customer delivery.",
        "Items without RAGFlow citations are traced to CRM, customer analysis, or explicit human input."
      ]
    };
  }
}

function buildExecutiveSummary(analysis: CustomerAnalysisResult): ProposalDraftSection {
  const painPoint = analysis.painPoints[0]?.title || "Confirmed customer data security scenario";
  const capability = analysis.recommendedCapabilities[0]?.title || "IP-Guard baseline controls";
  return {
    sectionId: "executive-summary",
    title: "Executive summary",
    body:
      analysis.narrativeSummary ||
      `${analysis.customerName} should prioritize ${capability} to address ${painPoint}. This draft is for internal review before customer delivery.`,
    traces: mergeTraces([
      tracesForItems(analysis.painPoints, analysis),
      tracesForItems(analysis.recommendedCapabilities, analysis)
    ])
  };
}

function buildItemSection(
  sectionId: string,
  title: string,
  items: CustomerAnalysisItem[],
  analysis: CustomerAnalysisResult
): ProposalDraftSection {
  return {
    sectionId,
    title,
    body: items.length > 0 ? items.map((item) => `${item.title}: ${item.detail}`).join("\n") : "No confirmed items yet.",
    traces: tracesForItems(items, analysis)
  };
}

function buildHumanInputsSection(humanInputs: NonNullable<ProposalGenerationRequest["humanInputs"]>): ProposalDraftSection {
  return {
    sectionId: "commercial-inputs",
    title: "Commercial and manual inputs",
    body: humanInputs.map((input) => `${input.label}: ${input.value}`).join("\n"),
    traces: humanInputs.map((input) => ({
      source: "human_input",
      inputId: input.inputId,
      label: input.label,
      note: input.value
    }))
  };
}

function tracesForItems(items: CustomerAnalysisItem[], analysis: CustomerAnalysisResult): ProposalTrace[] {
  const traces = items.flatMap((item) => tracesForItem(item, analysis));
  if (traces.length > 0) {
    return traces;
  }

  return [
    {
      source: "human_input",
      inputId: `${analysis.analysisId}:analysis`,
      label: "Customer analysis",
      note: "No specific item was returned; manual review is required."
    }
  ];
}

function tracesForItem(item: CustomerAnalysisItem, analysis: CustomerAnalysisResult): ProposalTrace[] {
  if (item.basis === "evidence" && item.evidenceChunkIds.length > 0) {
    return item.evidenceChunkIds.map((chunkId) => {
      const citation = analysis.evidence.find((entry) => entry.chunkId === chunkId);
      return {
        source: "citation",
        chunkId,
        label: citation?.title || item.title,
        note: item.detail
      };
    });
  }

  return [
    {
      source: "human_input",
      inputId: `${analysis.analysisId}:${item.title}`,
      label: traceLabelForBasis(item.basis),
      note: item.detail
    }
  ];
}

function traceLabelForBasis(basis: AnalysisBasis): string {
  return basis === "evidence" ? "Customer analysis evidence" : "Customer analysis inference";
}

function mergeTraces(groups: ProposalTrace[][]): ProposalTrace[] {
  const merged = new Map<string, ProposalTrace>();
  for (const trace of groups.flat()) {
    const key = `${trace.source}:${trace.chunkId ?? trace.inputId ?? trace.label}`;
    merged.set(key, trace);
  }
  return [...merged.values()];
}

function createDraftId(): string {
  return createPrefixedId("proposal-draft");
}
