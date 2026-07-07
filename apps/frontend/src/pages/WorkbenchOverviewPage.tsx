import { useEffect, useState } from "react";
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography } from "antd";
import { api } from "../api";
import { PlainList as List } from "../components/PlainList";
import type { WorkbenchOverview, WorkbenchTask, WorkbenchTaskScope } from "../types";

type WorkbenchMode = "overview" | "myTasks" | "teamTasks";

type WorkbenchOverviewPageProps = {
  mode: WorkbenchMode;
};

const modeCopy: Record<WorkbenchMode, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "WORKBENCH",
    title: "总览看板",
    description: "查看今天的售前任务、客户动作和关键运营提示。"
  },
  myTasks: {
    eyebrow: "MY TASKS",
    title: "我的待办",
    description: "聚焦当前账号需要推进的售前动作。"
  },
  teamTasks: {
    eyebrow: "TEAM",
    title: "团队任务",
    description: "查看售前团队共享任务和阻塞项。"
  }
};

export function WorkbenchOverviewPage({ mode }: WorkbenchOverviewPageProps) {
  const [overview, setOverview] = useState<WorkbenchOverview | null>(null);
  const [tasks, setTasks] = useState<WorkbenchTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const copy = modeCopy[mode];

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

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">{copy.eyebrow}</Typography.Text>
          <Typography.Title level={2}>{copy.title}</Typography.Title>
          <Typography.Paragraph type="secondary">{copy.description}</Typography.Paragraph>
        </div>
        {overview && (
          <div className="workbench-metric-grid">
            {overview.metrics.map((metric) => (
              <div className="workbench-metric" key={metric.key}>
                <Typography.Text type="secondary">{metric.label}</Typography.Text>
                <strong>{metric.value}</strong>
                <Typography.Text type="secondary">{metric.hint}</Typography.Text>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} />}

      {!overview && (
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Card className="pas-panel">
              <Statistic title="任务数" value={tasks.length} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="pas-panel">
              <Statistic title="高优先级" value={tasks.filter((task) => task.priority === "high").length} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="pas-panel">
              <Statistic title="阻塞项" value={tasks.filter((task) => task.status === "blocked").length} />
            </Card>
          </Col>
        </Row>
      )}

      <Card className="pas-panel" title={mode === "overview" ? "近期待办" : copy.title}>
        <List
          dataSource={tasks}
          locale={{ emptyText: "暂无待办" }}
          renderItem={(task) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Text strong>{task.title}</Typography.Text>
                    <Tag color={priorityColor(task.priority)}>{priorityText(task.priority)}</Tag>
                    <Tag color={statusColor(task.status)}>{statusText(task.status)}</Tag>
                  </Space>
                }
                description={`${task.customerName} / ${task.owner} / 截止 ${task.dueAt}`}
              />
            </List.Item>
          )}
        />
      </Card>

      {overview && (
        <Card className="pas-panel" title="最近动态">
          <List
            dataSource={overview.activities}
            renderItem={(activity) => (
              <List.Item>
                <List.Item.Meta
                  title={activity.title}
                  description={`${activity.description} / ${activity.happenedAt}`}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </Space>
  );
}

function priorityText(priority: WorkbenchTask["priority"]): string {
  return priority === "high" ? "高" : priority === "medium" ? "中" : "低";
}

function priorityColor(priority: WorkbenchTask["priority"]): string {
  return priority === "high" ? "red" : priority === "medium" ? "orange" : "default";
}

function statusText(status: WorkbenchTask["status"]): string {
  switch (status) {
    case "in_progress":
      return "进行中";
    case "blocked":
      return "阻塞";
    case "done":
      return "完成";
    default:
      return "待处理";
  }
}

function statusColor(status: WorkbenchTask["status"]): string {
  return status === "blocked" ? "red" : status === "in_progress" ? "blue" : status === "done" ? "green" : "default";
}
