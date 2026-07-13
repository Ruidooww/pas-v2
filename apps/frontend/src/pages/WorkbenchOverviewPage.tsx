import { useEffect, useMemo, useState } from "react";
import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SyncOutlined
} from "@ant-design/icons";
import { Alert, Avatar, Button, Card, Empty, Space, Tag, Typography } from "antd";
import { api } from "../api";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { buildDrilldownSearch, useDrilldownQuery } from "../drilldown";
import type { PublicUser, SecondaryMenuKey, WorkbenchActivity, WorkbenchMetric, WorkbenchOverview, WorkbenchTask, WorkbenchTaskScope } from "../types";

type WorkbenchMode = "overview" | "myTasks" | "teamTasks";
const taskDrilldownSchema = {
  priority: ["high"],
  status: ["active", "blocked", "done"]
} as const;

type WorkbenchOverviewPageProps = {
  mode: WorkbenchMode;
  user?: PublicUser;
  onNavigate: (key: SecondaryMenuKey, search?: string) => void;
};

type DashboardKpi = {
  key: string;
  label: string;
  value: number | string;
  hint: string;
};

type DashboardTask = {
  id: string;
  title: string;
  description: string;
  dueAt: string;
  owner: string;
  status: string;
  statusTone: "blue" | "orange" | "green" | "gray" | "red";
  dotTone: "red" | "orange" | "green" | "purple";
};

type DashboardActivity = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: "blue" | "green" | "orange";
};

const modeCopy: Record<WorkbenchMode, { title: string; description: string }> = {
  overview: {
    title: "总览看板",
    description: "聚焦关键客户与方案进度，推进每一次成交。"
  },
  myTasks: {
    title: "我的待办",
    description: "聚焦当前账号需要推进的售前动作。"
  },
  teamTasks: {
    title: "团队任务",
    description: "查看售前团队共享任务和阻塞项。"
  }
};

export function WorkbenchOverviewPage({ mode, user, onNavigate }: WorkbenchOverviewPageProps) {
  const [overview, setOverview] = useState<WorkbenchOverview | null>(null);
  const [tasks, setTasks] = useState<WorkbenchTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const copy = modeCopy[mode];
  const displayName = user?.displayName || "当前用户";
  const [taskDrilldown, updateTaskDrilldown] = useDrilldownQuery(taskDrilldownSchema);

  useEffect(() => {
    setError(null);
    if (mode === "overview") {
      api<WorkbenchOverview>("/api/internal/workbench/overview")
        .then((response) => {
          setOverview(response);
          setTasks(response.tasks);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "工作台加载失败"));
      return;
    }

    const scope: WorkbenchTaskScope = mode === "teamTasks" ? "team" : "mine";
    api<{ scope: WorkbenchTaskScope; tasks: WorkbenchTask[] }>(`/api/internal/workbench/tasks?scope=${scope}`)
      .then((response) => {
        setOverview(null);
        setTasks(response.tasks);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "待办加载失败"));
  }, [mode]);

  const kpis = useMemo(() => mapMetrics(overview?.metrics, tasks), [overview?.metrics, tasks]);
  const visibleTasks = useMemo(() => filterTasks(tasks, taskDrilldown), [taskDrilldown, tasks]);
  const dashboardTasks = useMemo(
    () => visibleTasks.map(mapTaskToDashboard).slice(0, 4),
    [visibleTasks]
  );
  const activities = useMemo(
    () => (overview?.activities?.length ? mapActivities(overview.activities) : []),
    [overview?.activities]
  );
  const reviewSummary = useMemo(() => buildReviewSummary(visibleTasks), [visibleTasks]);
  const riskReviews = useMemo(() => buildRiskReviews(visibleTasks), [visibleTasks]);
  const displayDate = overview?.generatedAt ? new Date(overview.generatedAt) : new Date();

  return (
    <section className="dashboard-page">
      <main className="dashboard-main">
        <header className="dashboard-greeting">
          <div>
            <Typography.Title level={2}>{mode === "overview" ? `早上好，${displayName}` : copy.title}</Typography.Title>
            <Typography.Paragraph type="secondary">{copy.description}</Typography.Paragraph>
          </div>
          <Typography.Text className="dashboard-date">{formatDashboardDate(displayDate)}</Typography.Text>
        </header>

        {mode !== "overview" && activeTaskFilterLabel(taskDrilldown) && (
          <Space className="drilldown-filter-summary" wrap>
            <Tag color="blue">当前筛选：{activeTaskFilterLabel(taskDrilldown)}</Tag>
            <Button
              type="link"
              size="small"
              onClick={() => updateTaskDrilldown({})}
            >
              清除筛选
            </Button>
          </Space>
        )}

        {error && <Alert className="dashboard-alert" type="error" message={error} closable onClose={() => setError(null)} />}

        <Card className="dashboard-focus-card">
          <div className="dashboard-focus-content">
            <div>
              <Typography.Title level={3}>聚焦重点，推动商机高质量落地</Typography.Title>
              <Typography.Paragraph type="secondary">持续跟进关键客户与项目，加强协作，提升赢单效率</Typography.Paragraph>
            </div>
            <div className="dashboard-hero-visual" aria-hidden="true">
              <span className="dashboard-hero-bar is-small" />
              <span className="dashboard-hero-bar is-medium" />
              <span className="dashboard-hero-bar is-large" />
              <span className="dashboard-hero-line" />
              <span className="dashboard-hero-dot" />
            </div>
          </div>
          <div className="dashboard-kpi-row">
            {kpis.map((kpi) => (
              <MetricDrilldown
                className="dashboard-kpi"
                key={kpi.key}
                label={kpi.label}
                onClick={() => navigateKpi(kpi.key, user, onNavigate)}
              >
                <Typography.Text type="secondary">{kpi.label}</Typography.Text>
                <strong>{kpi.value}</strong>
                <Typography.Text className="dashboard-kpi-trend">{kpi.hint}</Typography.Text>
              </MetricDrilldown>
            ))}
          </div>
        </Card>

        <div className="dashboard-lower-grid">
          <Card className="dashboard-panel" title="重点待办">
            <div className="dashboard-task-list">
              {dashboardTasks.length ? (
                dashboardTasks.map((task) => (
                  <div className="dashboard-task-row" key={task.id}>
                    <span className={`dashboard-task-dot is-${task.dotTone}`} />
                    <div className="dashboard-task-copy">
                      <Typography.Text strong>{task.title}</Typography.Text>
                      <Typography.Text type="secondary">{task.description}</Typography.Text>
                    </div>
                    <Typography.Text className="dashboard-task-date">
                      <CalendarOutlined />
                      {task.dueAt}
                    </Typography.Text>
                    <Avatar className="dashboard-task-avatar" size={24}>
                      {task.owner.slice(0, 1)}
                    </Avatar>
                    <Tag className={`dashboard-status is-${task.statusTone}`}>{task.status}</Tag>
                  </div>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待办" />
              )}
            </div>
          </Card>

          <Card className="dashboard-panel" title="风险与评审">
            <div className="dashboard-risk-list">
              {riskReviews.length ? (
                riskReviews.map((item) => (
                  <div className="dashboard-risk-row" key={item.id}>
                    <span className={`dashboard-risk-icon is-${item.tone}`}>
                      {item.tone === "red" ? <SafetyCertificateOutlined /> : <FileTextOutlined />}
                    </span>
                    <div>
                      <Typography.Text strong>{item.title}</Typography.Text>
                      <Typography.Text type="secondary">{item.description}</Typography.Text>
                    </div>
                    <Typography.Text className={`dashboard-risk-label is-${item.tone}`}>{item.risk}</Typography.Text>
                  </div>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无风险项" />
              )}
            </div>
          </Card>
        </div>

        <Typography.Text className="dashboard-updated">
          最近更新：{formatUpdatedAt(overview?.generatedAt)}
          <SyncOutlined />
        </Typography.Text>
      </main>

      <aside className="dashboard-side">
        <Card className="dashboard-side-card" title="评审与交付">
          {reviewSummary.map((item) => (
            <MetricDrilldown
              className="dashboard-review-row"
              key={item.key}
              label={item.label}
              onClick={() => navigateReview(item.key, user, onNavigate)}
            >
              <span className={`dashboard-review-icon is-${item.tone}`}>{item.icon}</span>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </MetricDrilldown>
          ))}
        </Card>

        <Card className="dashboard-side-card dashboard-activity-card" title="近期动态">
          {activities.length ? (
            activities.map((activity) => (
              <div className="dashboard-activity-row" key={activity.id}>
                <span className={`dashboard-activity-dot is-${activity.tone}`} />
                <div>
                  <Typography.Text strong>{activity.title}</Typography.Text>
                  <Typography.Text type="secondary">{activity.description}</Typography.Text>
                </div>
                <Typography.Text type="secondary">{activity.time}</Typography.Text>
              </div>
            ))
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无动态" />
          )}
        </Card>
      </aside>
    </section>
  );
}

function filterTasks(tasks: WorkbenchTask[], drilldown: Record<string, string>): WorkbenchTask[] {
  return tasks.filter((task) => {
    if (drilldown.priority && task.priority !== drilldown.priority) return false;
    if (drilldown.status === "active" && task.status === "done") return false;
    if (drilldown.status && drilldown.status !== "active" && task.status !== drilldown.status) return false;
    return true;
  });
}

function activeTaskFilterLabel(drilldown: Record<string, string>): string | undefined {
  if (drilldown.priority === "high") return "高优先级";
  if (drilldown.status === "active") return "待处理";
  if (drilldown.status === "blocked") return "阻塞";
  if (drilldown.status === "done") return "已完成";
  return undefined;
}

function navigateKpi(
  key: string,
  user: PublicUser | undefined,
  onNavigate: (key: SecondaryMenuKey, search?: string) => void
): void {
  if (key === "high_priority") {
    onNavigate("my_tasks", buildDrilldownSearch({ priority: "high" }));
    return;
  }
  if (key === "blocked") {
    onNavigate(user?.role === "sales" ? "my_tasks" : "team_tasks", buildDrilldownSearch({ status: "blocked" }));
    return;
  }
  if (key === "customers") {
    onNavigate("customer_management");
    return;
  }
  onNavigate("my_tasks", buildDrilldownSearch({ status: "active" }));
}

function navigateReview(
  key: string,
  user: PublicUser | undefined,
  onNavigate: (key: SecondaryMenuKey, search?: string) => void
): void {
  if (key === "proposal") {
    onNavigate("proposal_tasks", buildDrilldownSearch({ source: "proposal" }));
    return;
  }
  onNavigate(
    user?.role === "sales" ? "my_tasks" : "team_tasks",
    buildDrilldownSearch({ status: key === "done" ? "done" : "blocked" })
  );
}

function mapMetrics(metrics: WorkbenchMetric[] | undefined, tasks: WorkbenchTask[]): DashboardKpi[] {
  if (metrics?.length) {
    return metrics.slice(0, 4).map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      hint: metric.hint
    }));
  }

  return [
    { key: "active_tasks", label: "待处理任务", value: tasks.filter((task) => task.status !== "done").length, hint: "来自工作台队列" },
    { key: "high_priority", label: "高优先级", value: tasks.filter((task) => task.priority === "high").length, hint: "今日优先推进" },
    { key: "blocked", label: "阻塞项", value: tasks.filter((task) => task.status === "blocked").length, hint: "需要业务输入" },
    { key: "completed", label: "已完成", value: tasks.filter((task) => task.status === "done").length, hint: "当前视图统计" }
  ];
}

function mapTaskToDashboard(task: WorkbenchTask): DashboardTask {
  const status = statusView(task.status);
  return {
    id: task.taskId,
    title: task.title,
    description: `${task.customerName} · ${sourceText(task.source)}`,
    dueAt: task.dueAt,
    owner: task.owner,
    status: status.label,
    statusTone: status.tone,
    dotTone: priorityTone(task.priority)
  };
}

function mapActivities(activities: WorkbenchActivity[]): DashboardActivity[] {
  const tones: DashboardActivity["tone"][] = ["blue", "green", "orange"];
  return activities.slice(0, 3).map((activity, index) => ({
    id: activity.activityId,
    title: activity.title,
    description: activity.description,
    time: activity.happenedAt,
    tone: tones[index % tones.length] ?? "blue"
  }));
}

function statusView(status: WorkbenchTask["status"]): { label: string; tone: DashboardTask["statusTone"] } {
  switch (status) {
    case "in_progress":
      return { label: "进行中", tone: "blue" };
    case "blocked":
      return { label: "阻塞", tone: "red" };
    case "done":
      return { label: "已完成", tone: "green" };
    default:
      return { label: "待处理", tone: "gray" };
  }
}

function buildReviewSummary(tasks: WorkbenchTask[]) {
  return [
    { key: "proposal", icon: <FileDoneOutlined />, label: "方案相关", count: tasks.filter((task) => task.source === "proposal").length, tone: "blue" },
    { key: "blocked", icon: <ClockCircleOutlined />, label: "阻塞中", count: tasks.filter((task) => task.status === "blocked").length, tone: "orange" },
    { key: "done", icon: <CheckCircleFilled />, label: "已完成", count: tasks.filter((task) => task.status === "done").length, tone: "green" }
  ];
}

function buildRiskReviews(tasks: WorkbenchTask[]) {
  return tasks
    .filter((task) => task.status === "blocked" || task.priority === "high")
    .slice(0, 3)
    .map((task) => {
      const tone = task.status === "blocked" ? "red" : "orange";
      return {
        id: task.taskId,
        title: task.title,
        description: `${task.customerName} · ${sourceText(task.source)}`,
        risk: task.status === "blocked" ? "阻塞" : "高优先级",
        tone
      };
    });
}

function priorityTone(priority: WorkbenchTask["priority"]): DashboardTask["dotTone"] {
  if (priority === "high") return "red";
  if (priority === "medium") return "orange";
  return "green";
}

function sourceText(source: WorkbenchTask["source"]): string {
  switch (source) {
    case "crm":
      return "客户跟进";
    case "proposal":
      return "方案评审";
    case "qa":
      return "知识运营";
    default:
      return "手动任务";
  }
}

function formatDashboardDate(date: Date): string {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `今天是 ${date.getFullYear()}年${month}月${day}日 ${weekdays[date.getDay()]}`;
}

function formatUpdatedAt(generatedAt?: string): string {
  if (!generatedAt) {
    return "等待更新";
  }

  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) {
    return generatedAt;
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
}
