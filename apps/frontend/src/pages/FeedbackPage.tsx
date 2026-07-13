import { useEffect, useState } from "react";
import { Alert, Button, Card, Space, Tag, Typography } from "antd";
import { api } from "../api";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { PlainList as List } from "../components/PlainList";
import { useDrilldownQuery } from "../drilldown";

type FeedbackRecord = {
  feedbackId: string;
  objectType: string;
  objectId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  issueType: string;
  comment: string;
  status: "open" | "triaged" | "resolved" | "rejected";
  createdBy: string;
  createdAt: string;
};

const feedbackDrilldownSchema = { feedback: ["all", "open", "negative"] } as const;

export function FeedbackPage() {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, updateDrilldown] = useDrilldownQuery(feedbackDrilldownSchema);
  const visibleRecords = filterFeedback(records, drilldown.feedback);
  const activeFilter = feedbackFilterLabel(drilldown.feedback);

  useEffect(() => {
    api<FeedbackRecord[]>("/api/internal/feedback")
      .then(setRecords)
      .catch((err) => setError(err instanceof Error ? err.message : "反馈加载失败"));
  }, []);

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">FEEDBACK</Typography.Text>
          <Typography.Title level={2}>反馈闭环</Typography.Title>
          <Typography.Paragraph type="secondary">收敛 QA、客户分析、方案和导出结果的人工反馈。</Typography.Paragraph>
        </div>
        <div className="workbench-metric-grid">
          <MetricDrilldown className="workbench-metric" label="反馈数" onClick={() => updateDrilldown({ feedback: "all" })}>
            <Typography.Text type="secondary">反馈数</Typography.Text>
            <strong>{records.length}</strong>
            <Typography.Text type="secondary">全部来源</Typography.Text>
          </MetricDrilldown>
          <MetricDrilldown className="workbench-metric" label="待处理" onClick={() => updateDrilldown({ feedback: "open" })}>
            <Typography.Text type="secondary">待处理</Typography.Text>
            <strong>{records.filter((record) => record.status === "open").length}</strong>
            <Typography.Text type="secondary">需要复核</Typography.Text>
          </MetricDrilldown>
          <MetricDrilldown className="workbench-metric" label="负反馈" onClick={() => updateDrilldown({ feedback: "negative" })}>
            <Typography.Text type="secondary">负反馈</Typography.Text>
            <strong>{records.filter((record) => record.rating <= 2).length}</strong>
            <Typography.Text type="secondary">优先改进</Typography.Text>
          </MetricDrilldown>
        </div>
      </section>

      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}

      {activeFilter && (
        <Space className="drilldown-filter-summary" wrap>
          <Tag color="blue">当前筛选：{activeFilter}</Tag>
          <Button type="link" size="small" onClick={() => updateDrilldown({})}>清除筛选</Button>
        </Space>
      )}

      <Card className="pas-panel" title="反馈记录">
        <List
          dataSource={visibleRecords}
          locale={{ emptyText: "暂无反馈" }}
          renderItem={(record) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Text strong>{record.objectType}</Typography.Text>
                    <Tag color={record.rating <= 2 ? "red" : "green"}>{record.rating}</Tag>
                    <Tag color={record.status === "open" ? "orange" : "blue"}>{record.status}</Tag>
                  </Space>
                }
                description={`${record.objectId} / ${record.issueType} / ${record.comment || "无备注"} / ${record.createdAt}`}
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}

function filterFeedback(records: FeedbackRecord[], feedback?: string): FeedbackRecord[] {
  if (feedback === "open") return records.filter((record) => record.status === "open");
  if (feedback === "negative") return records.filter((record) => record.rating <= 2);
  return records;
}

function feedbackFilterLabel(feedback?: string): string | undefined {
  if (feedback === "all") return "全部反馈";
  if (feedback === "open") return "待处理";
  if (feedback === "negative") return "负反馈";
  return undefined;
}
