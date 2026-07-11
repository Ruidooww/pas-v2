import { expect, it, vi } from "vitest";

const pageModules = vi.hoisted(() => {
  const loaded: string[] = [];
  return {
    loaded,
    mock(exportName: string) {
      loaded.push(exportName);
      return { [exportName]: () => null };
    }
  };
});

vi.mock("./pages/AccountsPage", () => pageModules.mock("AccountsPage"));
vi.mock("./pages/AiModelAccessPage", () => pageModules.mock("AiModelAccessPage"));
vi.mock("./pages/AuditLogsPage", () => pageModules.mock("AuditLogsPage"));
vi.mock("./pages/BusinessFlowsPage", () => pageModules.mock("BusinessFlowsPage"));
vi.mock("./pages/CustomerManagementPage", () => pageModules.mock("CustomerManagementPage"));
vi.mock("./pages/DataAttachmentsPage", () => pageModules.mock("DataAttachmentsPage"));
vi.mock("./pages/ExportJobsPage", () => pageModules.mock("ExportJobsPage"));
vi.mock("./pages/ExportTemplatesPage", () => pageModules.mock("ExportTemplatesPage"));
vi.mock("./pages/FeedbackPage", () => pageModules.mock("FeedbackPage"));
vi.mock("./pages/KnowledgeBlocksPage", () => pageModules.mock("KnowledgeBlocksPage"));
vi.mock("./pages/KnowledgeDocumentsPage", () => pageModules.mock("KnowledgeDocumentsPage"));
vi.mock("./pages/MenuConfigPage", () => pageModules.mock("MenuConfigPage"));
vi.mock("./pages/PlatformPage", () => pageModules.mock("PlatformPage"));
vi.mock("./pages/ProposalLibraryPage", () => pageModules.mock("ProposalLibraryPage"));
vi.mock("./pages/QaPage", () => pageModules.mock("QaPage"));
vi.mock("./pages/SystemSettingsPage", () => pageModules.mock("SystemSettingsPage"));
vi.mock("./pages/WorkbenchPage", () => pageModules.mock("WorkbenchPage"));
vi.mock("./pages/WorkbenchOverviewPage", () => pageModules.mock("WorkbenchOverviewPage"));

it(
  "keeps every authenticated page module out of the app shell import",
  async () => {
    expect(pageModules.loaded).toEqual([]);
    await import("./App");
    expect(pageModules.loaded).toEqual([]);
  },
  45_000
);
