import type { WorkbenchOverview, WorkbenchTask, WorkbenchTaskScope } from "./workbench.types";

const TASKS: WorkbenchTask[] = [
  {
    taskId: "task-hx-proposal",
    title: "华信精工终端防泄漏方案初稿",
    customerName: "华信精工",
    owner: "Admin",
    status: "in_progress",
    priority: "high",
    dueAt: "2026-07-08",
    source: "proposal"
  },
  {
    taskId: "task-rs-analysis",
    title: "融盛金服客户画像补充",
    customerName: "融盛金服",
    owner: "售前一组",
    status: "pending",
    priority: "medium",
    dueAt: "2026-07-09",
    source: "crm"
  },
  {
    taskId: "task-ly-template",
    title: "岚云软件研发场景模板复核",
    customerName: "岚云软件",
    owner: "方案运营",
    status: "blocked",
    priority: "medium",
    dueAt: "2026-07-10",
    source: "manual"
  },
  {
    taskId: "task-hx-review",
    title: "华信精工会后输出人工确认",
    customerName: "华信精工",
    owner: "售前主管",
    status: "pending",
    priority: "high",
    dueAt: "2026-07-08",
    source: "qa"
  }
];

export class WorkbenchService {
  getOverview(): WorkbenchOverview {
    const activeTasks = TASKS.filter((task) => task.status !== "done");
    return {
      generatedAt: new Date().toISOString(),
      metrics: [
        { key: "active_tasks", label: "待处理任务", value: activeTasks.length, hint: "来自工作台样例队列" },
        { key: "high_priority", label: "高优先级", value: TASKS.filter((task) => task.priority === "high").length, hint: "今日优先推进" },
        { key: "blocked", label: "外部阻塞", value: TASKS.filter((task) => task.status === "blocked").length, hint: "需要业务输入" },
        { key: "customers", label: "样例客户", value: 3, hint: "沿用 CRM 样例客户池" }
      ],
      tasks: activeTasks.slice(0, 3),
      activities: [
        {
          activityId: "act-proposal-generated",
          title: "方案任务已创建",
          description: "华信精工 DLP 方案进入初稿阶段",
          happenedAt: "2026-07-07T09:20:00.000Z"
        },
        {
          activityId: "act-customer-analysis",
          title: "客户画像已刷新",
          description: "融盛金服风险合规需求进入售前视图",
          happenedAt: "2026-07-07T08:45:00.000Z"
        }
      ]
    };
  }

  listTasks(scope: WorkbenchTaskScope): WorkbenchTask[] {
    if (scope === "team") {
      return TASKS.map(cloneTask);
    }
    return TASKS.filter((task) => task.owner === "Admin" || task.priority === "high").map(cloneTask);
  }
}

function cloneTask(task: WorkbenchTask): WorkbenchTask {
  return { ...task };
}
