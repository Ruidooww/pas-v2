import { useEffect, useState } from "react";
import { Alert, Card, List, Space, Tag, Typography } from "antd";
import { api } from "../api";
import type { ProposalLibraryItem } from "../types";

export function ProposalLibraryPage() {
  const [items, setItems] = useState<ProposalLibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProposalLibraryItem[]>("/api/internal/proposals/library")
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "方案库加载失败"));
  }, []);

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">PROPOSALS</Typography.Text>
          <Typography.Title level={2}>方案库</Typography.Title>
          <Typography.Paragraph type="secondary">汇总已生成方案与内置样例，正式模板到位后承接导出与复用。</Typography.Paragraph>
        </div>
        <div className="workbench-metric-grid">
          <div className="workbench-metric">
            <Typography.Text type="secondary">方案数</Typography.Text>
            <strong>{items.length}</strong>
            <Typography.Text type="secondary">generated + mock</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">生成方案</Typography.Text>
            <strong>{items.filter((item) => item.source === "generated").length}</strong>
            <Typography.Text type="secondary">当前账号可见</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">样例</Typography.Text>
            <strong>{items.filter((item) => item.source === "mock").length}</strong>
            <Typography.Text type="secondary">V0 演示</Typography.Text>
          </div>
        </div>
      </section>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} />}

      <Card className="pas-panel" title="方案条目">
        <List
          dataSource={items}
          locale={{ emptyText: "暂无方案" }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Tag color={item.source === "generated" ? "blue" : "default"}>{item.source}</Tag>
                    <Tag color={item.status === "export_ready" ? "green" : "gold"}>{item.status}</Tag>
                  </Space>
                }
                description={
                  <Space wrap>
                    <span>{item.customerName}</span>
                    <span>{item.updatedAt}</span>
                    {item.formats.map((format) => (
                      <Tag key={format}>{format}</Tag>
                    ))}
                    {item.tags.map((tag) => (
                      <Tag key={tag} color="blue">
                        {tag}
                      </Tag>
                    ))}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}
