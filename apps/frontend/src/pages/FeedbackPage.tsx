import { useEffect, useState } from "react";
import { Alert, Card, List, Space, Tag, Typography } from "antd";
import { api } from "../api";

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

export function FeedbackPage() {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          <div className="workbench-metric">
            <Typography.Text type="secondary">反馈数</Typography.Text>
            <strong>{records.length}</strong>
            <Typography.Text type="secondary">全部来源</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">待处理</Typography.Text>
            <strong>{records.filter((record) => record.status === "open").length}</strong>
            <Typography.Text type="secondary">需要复核</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">负反馈</Typography.Text>
            <strong>{records.filter((record) => record.rating <= 2).length}</strong>
            <Typography.Text type="secondary">优先改进</Typography.Text>
          </div>
        </div>
      </section>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} />}

      <Card className="pas-panel" title="反馈记录">
        <List
          dataSource={records}
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
