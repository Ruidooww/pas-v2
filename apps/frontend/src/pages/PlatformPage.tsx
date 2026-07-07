import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Descriptions, Input, Row, Select, Spin, Statistic, Tag, Typography } from "antd";
import { api } from "../api";
import type { PlatformChannelKind, PlatformOverview, PlatformSkill, PublicUser } from "../types";

const channelOptions: Array<{ value: PlatformChannelKind; label: string }> = [
  { value: "web", label: "Web" },
  { value: "mobile_h5", label: "Mobile H5" },
  { value: "feishu", label: "Feishu" },
  { value: "wecom", label: "WeCom" },
  { value: "qq", label: "QQ" },
  { value: "wechat", label: "WeChat" }
];

const signalLabels: Record<string, string> = {
  silent_customer: "沉默客户",
  competitor_involved: "竞品介入",
  personnel_change: "人事变动",
  purchase_window: "采购窗口",
  security_incident: "安全事件",
  renewal_expansion: "续约扩容"
};

type PlatformPageMode = "analytics" | "governance";
type PlatformSectionKey = "channels" | "skills" | "products" | "cip" | "tenant" | "security";

const platformSections: Array<{ key: PlatformSectionKey; label: string }> = [
  { key: "channels", label: "多渠道入口" },
  { key: "skills", label: "Agent / Skill 编排" },
  { key: "products", label: "产品注册与扩展" },
  { key: "cip", label: "CIP 深化" },
  { key: "tenant", label: "多组织/商业化预留" },
  { key: "security", label: "平台安全与审计" }
];

export function PlatformPage({ user, mode }: { user: PublicUser; mode: PlatformPageMode }) {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<PlatformSectionKey>("channels");
  const [channel, setChannel] = useState<PlatformChannelKind>("feishu");
  const [messageText, setMessageText] = useState("请基于华信精工资料生成方案");
  const [skillName, setSkillName] = useState("Proposal Brief Builder");
  const [productName, setProductName] = useState("Partner DLP Suite");
  const [evidenceText, setEvidenceText] = useState(
    "90天未拜访，竞品进入测试，信息化负责人离职，9月采购窗口，发生终端泄密事件，维保即将到期"
  );

  useEffect(() => {
    void refresh();
  }, []);

  const pendingSkill = useMemo(
    () => overview?.skills.find((skill) => skill.status === "pending_approval"),
    [overview?.skills]
  );
  const firstWorkflow = overview?.workflows[0];
  const isAdmin = user.role === "admin";
  const canRunWorkflow = user.role === "admin" || user.role === "presales";

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api<PlatformOverview>("/api/internal/platform/overview");
      setOverview(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "平台数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  const run = async (action: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "平台操作失败");
    } finally {
      setLoading(false);
    }
  };

  if (!overview) {
    return (
      <div className="pas-page-stack platform-page">
        <Card className="pas-panel platform-section-panel">
          {error ? (
            <Alert
              type="error"
              showIcon
              title={error}
              action={
                <Button size="small" onClick={() => void refresh()} loading={loading}>
                  重试
                </Button>
              }
            />
          ) : (
            <div className="platform-loading">
              <Spin />
            </div>
          )}
        </Card>
      </div>
    );
  }

  const activeChannels = overview.channels.filter((item) => item.status === "active").length;
  const approvedSkills = overview.skills.filter((skill) => skill.status === "approved").length;
  const enabledProducts = overview.products.filter((product) => product.status === "enabled").length;
  const isAnalyticsMode = mode === "analytics";

  return (
    <div className="pas-page-stack platform-page">
      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}

      <section className="system-hero platform-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">{isAnalyticsMode ? "OPERATIONS" : "PLATFORM"}</Typography.Text>
          <Typography.Title level={3}>{isAnalyticsMode ? "运营分析" : "平台接入"}</Typography.Title>
          <Typography.Text type="secondary">
            {isAnalyticsMode
              ? "查看销售漏斗、赢单率、待外部输入和 CIP 信号等运营指标。"
              : "管理渠道入口、Agent/Skill、产品能力和平台级安全边界。"}
          </Typography.Text>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">活跃渠道</Typography.Text>
          <strong>{activeChannels}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">已批准 Skill</Typography.Text>
          <strong>{approvedSkills}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">启用产品</Typography.Text>
          <strong>{enabledProducts}</strong>
        </div>
      </section>

      {isAnalyticsMode && (
        <Card className="pas-panel platform-section-panel" title="运营指标">
          <Row gutter={[12, 12]}>
            {overview.dashboard.cards.map((card) => (
              <Col xs={12} md={8} xl={6} key={card.key}>
                <Statistic title={card.title} value={card.value} suffix={card.unit} />
              </Col>
            ))}
          </Row>
          <div className="platform-methodology">
            {overview.dashboard.methodology.map((item) => (
              <Tag key={item.key} color="blue">
                {item.key}
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {!isAnalyticsMode && (
        <nav className="platform-tertiary-nav" aria-label="平台接入三级菜单">
          {platformSections.map((section) => (
            <button
              className={section.key === activeSection ? "is-active" : undefined}
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      )}

      {!isAnalyticsMode && activeSection === "channels" && (
        <Card className="pas-panel platform-section-panel" title="多渠道入口">
          <div className="platform-form-grid">
            <Select value={channel} options={channelOptions} onChange={setChannel} />
            <Input.TextArea rows={3} value={messageText} onChange={(event) => setMessageText(event.target.value)} />
            <Button
              type="primary"
              loading={loading}
              onClick={() =>
                void run(() =>
                  api("/api/internal/platform/channels/messages", {
                    method: "POST",
                    body: {
                      channel,
                      externalUserId: "external-demo-user",
                      text: messageText,
                      sourceRef: "v3-console-message"
                    }
                  })
                )
              }
            >
              路由消息
            </Button>
          </div>
          <div className="platform-list">
            {overview.channels.map((item) => (
              <div className="platform-list-item" key={item.channelId}>
                <Typography.Text strong>{item.name}</Typography.Text>
                <Tag color={item.status === "active" ? "green" : "orange"}>{item.status}</Tag>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isAnalyticsMode && activeSection === "skills" && (
        <Card className="pas-panel platform-section-panel" title="Agent / Skill 编排">
          <div className="platform-form-grid">
            <Input value={skillName} onChange={(event) => setSkillName(event.target.value)} />
            <div className="platform-actions">
              {isAdmin && (
                <>
                  <Button
                    type="primary"
                    loading={loading}
                    onClick={() =>
                      void run(() =>
                        api("/api/internal/platform/skills/import", {
                          method: "POST",
                          body: {
                            name: skillName,
                            description: "整理客户需求并生成方案提纲",
                            requestedScopes: ["proposal:write", "knowledge:read"],
                            packageManifest: `name: ${skillName}`
                          }
                        })
                      )
                    }
                  >
                    导入 Skill
                  </Button>
                  <Button
                    disabled={!pendingSkill}
                    onClick={() =>
                      pendingSkill &&
                      void run(() =>
                        api(`/api/internal/platform/skills/${pendingSkill.skillId}/approve`, {
                          method: "PATCH"
                        })
                      )
                    }
                  >
                    审批 Skill
                  </Button>
                </>
              )}
              <Button
                disabled={!canRunWorkflow || !firstWorkflow}
                onClick={() =>
                  firstWorkflow &&
                  void run(() =>
                    api(`/api/internal/platform/workflows/${firstWorkflow.workflowId}/run`, {
                      method: "POST",
                      body: {
                        input: {
                          customerId: "demo-huaxin-manufacturing",
                          trigger: "purchase-window"
                        }
                      }
                    })
                  )
                }
              >
                运行工作流
              </Button>
            </div>
          </div>
          <SkillList skills={overview.skills} />
        </Card>
      )}

      {!isAnalyticsMode && activeSection === "products" && (
        <Card className="pas-panel platform-section-panel" title="产品注册与扩展">
          <div className="platform-form-grid">
            {isAdmin && (
              <>
                <Input value={productName} onChange={(event) => setProductName(event.target.value)} />
                <Button
                  type="primary"
                  loading={loading}
                  onClick={() =>
                    void run(() =>
                      api("/api/internal/platform/products/register", {
                        method: "POST",
                        body: {
                          name: productName,
                          version: "1.0",
                          ownerTeam: "渠道事业部",
                          knowledgePartitionIds: ["partner-dlp"],
                          proposalTemplateIds: ["proposal-partner-dlp-v1"],
                          exportTemplateIds: ["docx-partner-dlp-v1", "pptx-partner-dlp-v1"],
                          webhookEvents: ["product.enabled", "proposal.generated"],
                          apiVersion: "v3",
                          pluginDependencies: ["proposal-brief-builder"]
                        }
                      })
                    )
                  }
                >
                  注册产品
                </Button>
              </>
            )}
          </div>
          <div className="platform-list">
            {overview.products.map((product) => (
              <div className="platform-list-item" key={product.productId}>
                <div>
                  <Typography.Text strong>{product.name}</Typography.Text>
                  <Typography.Text type="secondary"> / {product.version}</Typography.Text>
                </div>
                <Tag color={product.pendingInputs.length > 0 ? "orange" : "green"}>{product.status}</Tag>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isAnalyticsMode && activeSection === "cip" && (
        <Card className="pas-panel platform-section-panel" title="CIP 深化">
          <div className="platform-form-grid">
            <Input.TextArea rows={4} value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} />
            <Button
              type="primary"
              loading={loading}
              onClick={() =>
                void run(() =>
                  api("/api/internal/platform/cip/signals", {
                    method: "POST",
                    body: {
                      customerId: "demo-huaxin-manufacturing",
                      customerName: "华信精工",
                      evidenceText
                    }
                  })
                )
              }
            >
              识别信号
            </Button>
          </div>
          <div className="platform-list">
            {overview.cipSignals.length === 0 ? (
              <Typography.Text type="secondary">暂无 CIP 信号</Typography.Text>
            ) : (
              overview.cipSignals.slice(0, 6).map((signal) => (
                <div className="platform-list-item" key={signal.signalId}>
                  <Typography.Text>{signalLabels[signal.type] ?? signal.type}</Typography.Text>
                  <Tag color={signal.severity === "high" ? "red" : "orange"}>{signal.severity}</Tag>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {!isAnalyticsMode && activeSection === "tenant" && (
        <Card className="pas-panel platform-section-panel" title="多组织/商业化预留">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Tenant">{overview.tenant.tenantId}</Descriptions.Item>
            <Descriptions.Item label="Organization">{overview.tenant.organizationId}</Descriptions.Item>
            <Descriptions.Item label="Mode">{overview.tenant.mode}</Descriptions.Item>
            <Descriptions.Item label="Billing">{overview.tenant.billingReserved ? "reserved" : "disabled"}</Descriptions.Item>
            <Descriptions.Item label="Fields">{overview.tenant.isolationFields.join(", ")}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {!isAnalyticsMode && activeSection === "security" && (
        <Card className="pas-panel platform-section-panel" title="平台安全与审计">
          <Statistic title="Audit Events" value={overview.security.totalEvents} />
          <div className="platform-list">
            {overview.security.permissionBoundaryChecks.map((check) => (
              <div className="platform-list-item" key={check.key}>
                <Typography.Text>{check.key}</Typography.Text>
                <Tag color={check.status === "passed" ? "green" : "orange"}>{check.status}</Tag>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SkillList({ skills }: { skills: PlatformSkill[] }) {
  return (
    <div className="platform-list">
      {skills.slice(0, 6).map((skill) => (
        <div className="platform-list-item" key={skill.skillId}>
          <div>
            <Typography.Text strong>{skill.name}</Typography.Text>
            <Typography.Text type="secondary"> / {skill.scan.riskLevel}</Typography.Text>
          </div>
          <Tag color={skill.status === "approved" ? "green" : skill.status === "rejected" ? "red" : "orange"}>
            {skill.status}
          </Tag>
        </div>
      ))}
    </div>
  );
}
