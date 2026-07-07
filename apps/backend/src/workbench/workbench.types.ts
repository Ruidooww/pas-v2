export type WorkbenchMetric = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
};

export type WorkbenchTaskScope = "mine" | "team";

export type WorkbenchTaskStatus = "pending" | "in_progress" | "blocked" | "done";

export type WorkbenchTask = {
  taskId: string;
  title: string;
  customerName: string;
  owner: string;
  status: WorkbenchTaskStatus;
  priority: "high" | "medium" | "low";
  dueAt: string;
  source: "crm" | "proposal" | "qa" | "manual";
};

export type WorkbenchActivity = {
  activityId: string;
  title: string;
  description: string;
  happenedAt: string;
};

export type WorkbenchOverview = {
  generatedAt: string;
  metrics: WorkbenchMetric[];
  tasks: WorkbenchTask[];
  activities: WorkbenchActivity[];
};
