import { useEffect, useState } from "react";
import { Alert, Card, Space, Table, Tag, Typography } from "antd";
import { EmptyState } from "../components/EmptyState";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { loadCustomers } from "../customer-api";
import { useDrilldownQuery } from "../drilldown";
import type { CrmCustomerSummary } from "../types";

type CustomerGrouping = "industry" | "region";
const customerDrilldownSchema = { groupBy: ["industry", "region"] } as const;

export function CustomerManagementPage() {
  const [customers, setCustomers] = useState<CrmCustomerSummary[]>([]);
  const [source, setSource] = useState<"mock" | "external">("mock");
  const [error, setError] = useState<string | null>(null);
  const [drilldown, updateDrilldown] = useDrilldownQuery(customerDrilldownSchema);
  const groupBy = drilldown.groupBy as CustomerGrouping | undefined;
  const isExternal = source === "external";

  useEffect(() => {
    loadCustomers()
      .then((result) => {
        setCustomers(result.customers);
        setSource(result.source);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "客户列表加载失败"));
  }, []);

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">CUSTOMERS</Typography.Text>
          <Typography.Title level={2}>客户管理</Typography.Title>
          <Typography.Paragraph type="secondary">
            {isExternal ? "当前展示外部 CRM 客户池，只读同步客户上下文。" : "当前使用内置客户样例池，真实 CRM 接口就绪后替换数据源。"}
          </Typography.Paragraph>
        </div>
        <div className="workbench-metric-grid">
          <MetricDrilldown className="workbench-metric" label="客户数" onClick={() => selectGrouping(undefined)}>
            <Typography.Text type="secondary">客户数</Typography.Text>
            <strong>{customers.length}</strong>
            <Typography.Text type="secondary">{isExternal ? "CRM 客户池" : "客户样例池"}</Typography.Text>
          </MetricDrilldown>
          <MetricDrilldown className="workbench-metric" label="行业数" onClick={() => selectGrouping("industry")}>
            <Typography.Text type="secondary">行业数</Typography.Text>
            <strong>{new Set(customers.map((customer) => customer.industry)).size}</strong>
            <Typography.Text type="secondary">{isExternal ? "CRM 维度" : "样例维度"}</Typography.Text>
          </MetricDrilldown>
          <MetricDrilldown className="workbench-metric" label="区域数" onClick={() => selectGrouping("region")}>
            <Typography.Text type="secondary">区域数</Typography.Text>
            <strong>{new Set(customers.map((customer) => customer.region)).size}</strong>
            <Typography.Text type="secondary">售前覆盖</Typography.Text>
          </MetricDrilldown>
        </div>
      </section>

      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}

      {groupBy && (
        <Card className="pas-panel drilldown-group-panel">
          <Typography.Title level={4}>{groupBy === "industry" ? "行业分布" : "区域分布"}</Typography.Title>
          <Space wrap>
            {groupCustomers(customers, groupBy).map((item) => (
              <Tag color="blue" key={item.label}>{`${item.label}：${item.count}`}</Tag>
            ))}
          </Space>
        </Card>
      )}

      <Card className="pas-panel" title="客户列表">
        <Table
          dataSource={customers}
          locale={{
            emptyText: (
              <EmptyState
                title={isExternal ? "暂无 CRM 客户" : "暂无客户样例"}
                description={
                  isExternal
                    ? "CRM 当前未返回可用客户。"
                    : "当前使用假数据；真实 CRM API 接好后会自动展示客户池。"
                }
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
              render: () => <Tag color={isExternal ? "green" : "blue"}>{isExternal ? "CRM 数据" : "样例"}</Tag>
            }
          ]}
        />
      </Card>
    </Space>
  );

  function selectGrouping(next: CustomerGrouping | undefined): void {
    updateDrilldown({ groupBy: next });
  }
}

function groupCustomers(customers: CrmCustomerSummary[], groupBy: CustomerGrouping) {
  const counts = new Map<string, number>();
  for (const customer of customers) {
    const label = customer[groupBy];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label)
  );
}
