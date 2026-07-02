import type { ExportPackage } from "../proposal/proposal.types";

export type ExportSectionView = {
  index: number;
  title: string;
  body: string;
  traceNote: string;
};

export type ExportCitationView = {
  index: number;
  title: string;
  source: string;
  chunkId: string;
  documentId: string;
  location: string;
};

export type ExportViewModel = {
  customerName: string;
  title: string;
  generatedAt: string;
  reviewNotice: string;
  sections: ExportSectionView[];
  citations: ExportCitationView[];
  assumptions: string[];
  sectionsSummary: string;
  citationsSummary: string;
  assumptionsSummary: string;
};

export const REVIEW_NOTICE = "AI 生成内容，需人工审核后方可对客户使用";

export function buildExportViewModel(exportPackage: ExportPackage): ExportViewModel {
  const draft = exportPackage.payload.proposalDraft;

  const sections: ExportSectionView[] = draft.sections.map((section, position) => ({
    index: position + 1,
    title: section.title,
    body: section.body,
    traceNote: section.traces.map((trace) => trace.label).join("; ")
  }));

  const citations: ExportCitationView[] = draft.citations.map((citation, position) => ({
    index: position + 1,
    title: citation.title,
    source: citation.source,
    chunkId: citation.chunkId,
    documentId: citation.documentId,
    location: formatLocation(citation.page, citation.position)
  }));

  return {
    customerName: draft.customerName,
    title: draft.title,
    generatedAt: formatDate(draft.generatedAt),
    reviewNotice: REVIEW_NOTICE,
    sections,
    citations,
    assumptions: [...draft.assumptions],
    sectionsSummary: sections
      .map((section) => `${section.index}. ${section.title}\n${truncate(section.body, 220)}`)
      .join("\n\n"),
    citationsSummary: citations
      .map((citation) => `[${citation.index}] ${citation.title} (${citation.source}${citation.location ? `, ${citation.location}` : ""})`)
      .join("\n"),
    assumptionsSummary: draft.assumptions.map((item, position) => `${position + 1}. ${item}`).join("\n")
  };
}

function formatLocation(page?: number, position?: string): string {
  if (page !== undefined && position) return `p.${page} ${position}`;
  if (page !== undefined) return `p.${page}`;
  return position ?? "";
}

function formatDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? isoDate : parsed.toISOString().slice(0, 10);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}
