import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  Row,
  Statistic,
  Tabs,
  Tag,
  Typography
} from "antd";
import { api } from "../api";
import type { BusinessFlowKind, BusinessFlowRecord, BusinessMetrics } from "../types";

const kindLabels: Record<BusinessFlowKind, string> = {
  opportunity: "商机",
  meeting: "会议",
  contract_review: "合同",
  after_sales: "售后",
  channel: "渠道",
  customer_signal: "CIP"
};

export function BusinessFlowsPage() {
  const [records, setRecords] = useState<BusinessFlowRecord[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetrics>({ definitions: [], counters: [] });
  const [lastRecord, setLastRecord] = useState<BusinessFlowRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunityText, setOpportunityText] = useState(
    "客户：华信精工；需求：终端数据防泄漏；预算：38万；时间：2026-09；联系人：周明；阶段：方案；来源：销售记录"
  );
  const [meetingCustomerId, setMeetingCustomerId] = useState("demo-huaxin-manufacturing");
  const [meetingText, setMeetingText] = useState(
    "客户关注图纸外发审计，需要下周给出透明加密试点方案。决策人周明，待办：售前输出测试计划。"
  );
  const [contractText, setContractText] = useState("付款周期为验收后180天。乙方承担无限责任。验收标准以后续邮件为准。");
  const [afterSalesQuestion, setAfterSalesQuestion] = useState("终端离线后策略不生效并且客户要求赔偿，怎么办？");
  const [signalText, setSignalText] = useState("竞品已进入测试\n客户要求9月前完成采购");

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    try {
      const [recordResponse, metricResponse] = await Promise.all([
        api<{ records: BusinessFlowRecord[] }>("/api/internal/business-flows/records"),
        api<BusinessMetrics>("/api/internal/business-flows/metrics")
      ]);
      setRecords(recordResponse.records);
      setMetrics(metricResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "V2 数据加载失败");
    }
  };

  const run = async (action: () => Promise<BusinessFlowRecord>) => {
    setLoading(true);
    setError(null);
    try {
      const record = await action();
      setLastRecord(record);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "V2 操作失败");
    } finally {
      setLoading(false);
    }
  };

  const latestOpportunity = lastRecord?.kind === "opportunity" ? lastRecord : undefined;
  const latestMeeting = lastRecord?.kind === "meeting" ? lastRecord : undefined;

  return (
    <div className="pas-page-stack">
      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} />}

      <Row gutter={[12, 12]} className="business-flow-metrics">
        <Col xs={24} md={8}>
          <Card className="pas-panel">
            <Statistic title="V2 Records" value={records.length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="pas-panel">
            <Statistic
              title="Pending Inputs"
              value={records.filter((record) => record.pendingInputs.length > 0).length}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="pas-panel">
            <Statistic
              title="Confirmed / Sync"
              value={records.filter((record) => record.status === "confirmed" || record.status === "sync_pending").length}
            />
          </Card>
        </Col>
      </Row>

      <Card className="pas-panel">
        <Tabs
          items={[
            {
              key: "opportunity",
              label: "商机",
              children: (
                <div className="business-flow-tab">
                  <Input.TextArea
                    rows={5}
                    value={opportunityText}
                    onChange={(event) => setOpportunityText(event.target.value)}
                  />
                  <div className="business-flow-actions">
                    <Button
                      type="primary"
                      loading={loading}
                      onClick={() =>
                        void run(() =>
                          api<BusinessFlowRecord>("/api/internal/business-flows/opportunities/extract", {
                            method: "POST",
                            body: { text: opportunityText, sourceRef: "v2-console-opportunity" }
                          })
                        )
                      }
                    >
                      提取商机
                    </Button>
                    <Button
                      disabled={!latestOpportunity?.outputs.opportunity}
                      onClick={() =>
                        latestOpportunity?.outputs.opportunity &&
                        void run(() =>
                          api<BusinessFlowRecord>(
                            `/api/internal/business-flows/opportunities/${latestOpportunity.recordId}/confirm`,
                            {
                              method: "PATCH",
                              body: { opportunity: latestOpportunity.outputs.opportunity }
                            }
                          )
                        )
                      }
                    >
                      人工确认
                    </Button>
                    <Button
                      disabled={latestOpportunity?.status !== "confirmed"}
                      onClick={() =>
                        latestOpportunity &&
                        void run(() =>
                          api<BusinessFlowRecord>(
                            `/api/internal/business-flows/opportunities/${latestOpportunity.recordId}/sync-request`,
                            { method: "POST" }
                          )
                        )
                      }
                    >
                      创建 CRM 写回请求
                    </Button>
                  </div>
                </div>
              )
            },
            {
              key: "meeting",
              label: "会议",
              children: (
                <div className="business-flow-tab">
                  <Input value={meetingCustomerId} onChange={(event) => setMeetingCustomerId(event.target.value)} />
                  <Input.TextArea rows={5} value={meetingText} onChange={(event) => setMeetingText(event.target.value)} />
                  <div className="business-flow-actions">
                    <Button
                      type="primary"
                      loading={loading}
                      onClick={() =>
                        void run(() =>
                          api<BusinessFlowRecord>("/api/internal/business-flows/meetings/summarize", {
                            method: "POST",
                            body: {
                              customerId: meetingCustomerId,
                              transcript: meetingText,
                              sourceRef: "v2-console-meeting"
                            }
                          })
                        )
                      }
                    >
                      生成纪要
                    </Button>
                    <Button
                      disabled={!latestMeeting?.outputs.meetingMinutes}
                      onClick={() =>
                        latestMeeting &&
                        void run(async () => {
                          const response = await api<{ record: BusinessFlowRecord }>(
                            `/api/internal/business-flows/meetings/${latestMeeting.recordId}/proposal`,
                            { method: "POST" }
                          );
                          return response.record;
                        })
                      }
                    >
                      生成会后方案
                    </Button>
                  </div>
                </div>
              )
            },
            {
              key: "contract",
              label: "合同",
              children: (
                <div className="business-flow-tab">
                  <Input.TextArea rows={5} value={contractText} onChange={(event) => setContractText(event.target.value)} />
                  <div className="business-flow-actions">
                    <Button
                      type="primary"
                      loading={loading}
                      onClick={() =>
                        void run(() =>
                          api<BusinessFlowRecord>("/api/internal/business-flows/contracts/review", {
                            method: "POST",
                            body: {
                              customerId: "demo-huaxin-manufacturing",
                              contractTitle: "V2 合同样本",
                              contractText,
                              sourceRef: "v2-console-contract"
                            }
                          })
                        )
                      }
                    >
                      审核合同
                    </Button>
                  </div>
                </div>
              )
            },
            {
              key: "after-sales",
              label: "售后",
              children: (
                <div className="business-flow-tab">
                  <Input.TextArea
                    rows={4}
                    value={afterSalesQuestion}
                    onChange={(event) => setAfterSalesQuestion(event.target.value)}
                  />
                  <div className="business-flow-actions">
                    <Button
                      type="primary"
                      loading={loading}
                      onClick={() =>
                        void run(() =>
                          api<BusinessFlowRecord>("/api/internal/business-flows/after-sales/answer", {
                            method: "POST",
                            body: {
                              customerId: "demo-huaxin-manufacturing",
                              question: afterSalesQuestion,
                              sourceRef: "v2-console-after-sales"
                            }
                          })
                        )
                      }
                    >
                      售后问答
                    </Button>
                    <Button
                      onClick={() =>
                        void run(() =>
                          api<BusinessFlowRecord>("/api/internal/business-flows/after-sales/maintenance-reminders", {
                            method: "POST",
                            body: {
                              customerId: "demo-huaxin-manufacturing",
                              productName: "IP-Guard",
                              contractEndDate: "2026-10-01",
                              sourceRef: "v2-console-maintenance"
                            }
                          })
                        )
                      }
                    >
                      生成维保提醒
                    </Button>
                  </div>
                </div>
              )
            },
            {
              key: "channel",
              label: "渠道",
              children: (
                <div className="business-flow-tab">
                  <div className="business-flow-actions">
                    <Button
                      type="primary"
                      loading={loading}
                      onClick={() =>
                        void run(() =>
                          api<BusinessFlowRecord>("/api/internal/business-flows/channels/context", {
                            method: "POST",
                            body: {
                              partnerName: "华东金牌渠道",
                              partnerLevel: "gold",
                              authorizedRegions: ["华东"],
                              customerName: "华信精工",
                              pricePolicy: "standard-discount-85",
                              registrationStatus: "registered_by_other_partner",
                              sourceRef: "v2-console-channel"
                            }
                          })
                        )
                      }
                    >
                      生成渠道上下文
                    </Button>
                  </div>
                </div>
              )
            },
            {
              key: "customer-signal",
              label: "CIP",
              children: (
                <div className="business-flow-tab">
                  <Input.TextArea rows={4} value={signalText} onChange={(event) => setSignalText(event.target.value)} />
                  <div className="business-flow-actions">
                    <Button
                      type="primary"
                      loading={loading}
                      onClick={() =>
                        void run(() =>
                          api<BusinessFlowRecord>("/api/internal/business-flows/customer-signals/analyze", {
                            method: "POST",
                            body: {
                              customerId: "demo-huaxin-manufacturing",
                              manualSignals: signalText.split("\n").filter(Boolean),
                              sourceRef: "v2-console-cip"
                            }
                          })
                        )
                      }
                    >
                      分析客情信号
                    </Button>
                  </div>
                </div>
              )
            },
            {
              key: "metrics",
              label: "指标",
              children: (
                <div className="business-flow-list">
                  {metrics.counters.map((counter) => (
                    <div className="business-flow-list-item" key={counter.name}>
                      <Typography.Text>{counter.name}</Typography.Text>
                      <Tag color={counter.value > 0 ? "blue" : "default"}>{counter.value}</Tag>
                    </div>
                  ))}
                </div>
              )
            }
          ]}
        />
      </Card>

      {lastRecord && <BusinessFlowResult record={lastRecord} />}

      <Card className="pas-panel" title="最近业务记录">
        {records.length === 0 ? (
          <Typography.Text type="secondary">暂无 V2 业务记录</Typography.Text>
        ) : (
          <div className="business-flow-list">
            {records
              .slice()
              .reverse()
              .slice(0, 8)
              .map((record) => (
                <div className="business-flow-list-item" key={record.recordId}>
              <div>
                <Typography.Text strong>{kindLabels[record.kind]}</Typography.Text>
                <Tag color={record.status === "sync_pending" ? "orange" : "blue"}>{record.status}</Tag>
                <Typography.Text type="secondary">{record.recordId}</Typography.Text>
                <div>
                  <Typography.Text type="secondary">
                    {record.source.system} / {record.source.reference}
                  </Typography.Text>
                </div>
              </div>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function BusinessFlowResult({ record }: { record: BusinessFlowRecord }) {
  return (
    <Card className="pas-panel" title="本次结果">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="类型">{kindLabels[record.kind]}</Descriptions.Item>
        <Descriptions.Item label="状态">{record.status}</Descriptions.Item>
        <Descriptions.Item label="来源">
          {record.source.system} / {record.source.reference}
        </Descriptions.Item>
        <Descriptions.Item label="后置输入">
          {record.pendingInputs.length > 0 ? record.pendingInputs.join(", ") : "无"}
        </Descriptions.Item>
      </Descriptions>
      <pre className="business-flow-json">{JSON.stringify(record.outputs, null, 2)}</pre>
    </Card>
  );
}
