export type FeedbackObjectType = "qa_answer" | "customer_analysis" | "proposal_draft" | "export_file";

export type FeedbackIssueType =
  | "retrieval"
  | "citation"
  | "llm"
  | "template"
  | "crm_data"
  | "permission"
  | "other";

export type FeedbackStatus = "open" | "triaged" | "resolved" | "rejected";

export type SubmitFeedbackRequest = {
  objectType: FeedbackObjectType;
  objectId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  issueType: FeedbackIssueType;
  comment: string;
};

export type FeedbackRecord = SubmitFeedbackRequest & {
  feedbackId: string;
  status: FeedbackStatus;
  createdBy: string;
  createdAt: string;
  handledBy?: string;
  handledAt?: string;
  resolutionNote?: string;
};

export type UpdateFeedbackStatusRequest = {
  status: FeedbackStatus;
  resolutionNote?: string;
};

export type RegressionCaseInput = {
  questionId: string;
  question: string;
  expectedEvidence: string;
  passed: boolean;
  failureReason?: string;
};

export type CreateRegressionRunRequest = {
  name: string;
  owner: string;
  approver: string;
  cases: RegressionCaseInput[];
};

export type RegressionGateStatus = "passed" | "failed" | "blocked";

export type RegressionFailureReason =
  | "REGRESSION_QUESTION_SET_INCOMPLETE"
  | "REGRESSION_CASES_FAILED";

export type RegressionRun = CreateRegressionRunRequest & {
  runId: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  canGoLive: boolean;
  gateStatus: RegressionGateStatus;
  failureReason?: RegressionFailureReason;
  createdBy: string;
  createdAt: string;
};

export type RegressionReport = RegressionRun & {
  evidenceType: "regression_report";
};
