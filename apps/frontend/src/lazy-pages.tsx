import { lazy } from "react";

export const AccountsPage = lazy(() =>
  import("./pages/AccountsPage").then((module) => ({ default: module.AccountsPage }))
);
export const AiModelAccessPage = lazy(() =>
  import("./pages/AiModelAccessPage").then((module) => ({ default: module.AiModelAccessPage }))
);
export const AuditLogsPage = lazy(() =>
  import("./pages/AuditLogsPage").then((module) => ({ default: module.AuditLogsPage }))
);
export const BusinessFlowsPage = lazy(() =>
  import("./pages/BusinessFlowsPage").then((module) => ({ default: module.BusinessFlowsPage }))
);
export const CustomerManagementPage = lazy(() =>
  import("./pages/CustomerManagementPage").then((module) => ({ default: module.CustomerManagementPage }))
);
export const DataAttachmentsPage = lazy(() =>
  import("./pages/DataAttachmentsPage").then((module) => ({ default: module.DataAttachmentsPage }))
);
export const ExportJobsPage = lazy(() =>
  import("./pages/ExportJobsPage").then((module) => ({ default: module.ExportJobsPage }))
);
export const ExportTemplatesPage = lazy(() =>
  import("./pages/ExportTemplatesPage").then((module) => ({ default: module.ExportTemplatesPage }))
);
export const FeedbackPage = lazy(() =>
  import("./pages/FeedbackPage").then((module) => ({ default: module.FeedbackPage }))
);
export const KnowledgeBlocksPage = lazy(() =>
  import("./pages/KnowledgeBlocksPage").then((module) => ({ default: module.KnowledgeBlocksPage }))
);
export const KnowledgeDocumentsPage = lazy(() =>
  import("./pages/KnowledgeDocumentsPage").then((module) => ({ default: module.KnowledgeDocumentsPage }))
);
export const MenuConfigPage = lazy(() =>
  import("./pages/MenuConfigPage").then((module) => ({ default: module.MenuConfigPage }))
);
export const PlatformPage = lazy(() =>
  import("./pages/PlatformPage").then((module) => ({ default: module.PlatformPage }))
);
export const ProposalLibraryPage = lazy(() =>
  import("./pages/ProposalLibraryPage").then((module) => ({ default: module.ProposalLibraryPage }))
);
export const QaPage = lazy(() => import("./pages/QaPage").then((module) => ({ default: module.QaPage })));
export const SystemSettingsPage = lazy(() =>
  import("./pages/SystemSettingsPage").then((module) => ({ default: module.SystemSettingsPage }))
);
export const WorkbenchPage = lazy(() =>
  import("./pages/WorkbenchPage").then((module) => ({ default: module.WorkbenchPage }))
);
export const WorkbenchOverviewPage = lazy(() =>
  import("./pages/WorkbenchOverviewPage").then((module) => ({ default: module.WorkbenchOverviewPage }))
);
