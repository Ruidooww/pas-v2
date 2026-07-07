import { useEffect, useState } from "react";
import { Alert, Card, Space, Table, Tag, Typography } from "antd";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import type { CrmCustomerSummary } from "../types";

export function CustomerManagementPage() {
  const [customers, setCustomers] = useState<CrmCustomerSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ customers: CrmCustomerSummary[] }>("/api/crm/customers")
      .then((response) => setCustomers(response.customers))
      .catch((err) => setError(err instanceof Error ? err.message : "客户列表加载失败"));
  }, []);

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">CUSTOMERS</Typography.Text>
          <Typography.Title level={2}>客户管理</Typography.Title>
          <Typography.Paragraph type="secondary">当前使用内置客户样例池，真实 CRM 接口就绪后替换数据源。</Typography.Paragraph>
        </div>
        <div className="workbench-metric-grid">
          <div className="workbench-metric">
            <Typography.Text type="secondary">客户数</Typography.Text>
            <strong>{customers.length}</strong>
            <Typography.Text type="secondary">客户样例池</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">行业数</Typography.Text>
            <strong>{new Set(customers.map((customer) => customer.industry)).size}</strong>
            <Typography.Text type="secondary">样例维度</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">区域数</Typography.Text>
            <strong>{new Set(customers.map((customer) => customer.region)).size}</strong>
            <Typography.Text type="secondary">售前覆盖</Typography.Text>
          </div>
        </div>
      </section>

      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}

      <Card className="pas-panel" title="客户列表">
        <Table
          dataSource={customers}
          locale={{
            emptyText: (
              <EmptyState
                title="暂无客户样例"
                description="当前使用假数据；真实 CRM API 接好后会自动展示客户池。"
              />
            )
          }}
          pagination={false}
          rowKey="customerId"
          columns={[
            { title: "客户", dataIndex: "name" },
            { title: "行业", dataIndex: "industry" },
            { title: "区域", dataIndex: "region" },
            { title: "负责人", dataIndex: "accountOwner" },
            {
              title: "状态",
              render: () => <Tag color="blue">样例</Tag>
            }
          ]}
        />
      </Card>
    </Space>
  );
}
