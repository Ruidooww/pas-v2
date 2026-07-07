import { useEffect, useMemo, useState } from "react";
import { Alert, Card, Descriptions, Spin, Tag, Typography } from "antd";
import { api } from "../api";
import type { SystemOverview, SystemSettingItem } from "../types";

const GROUP_TITLES: Record<SystemSettingItem["group"], string> = {
  ragflow: "RAGFlow",
  llm: "LLM",
  storage: "存储",
  database: "数据库",
  export: "导出"
};

export function SystemSettingsPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshOverview();
  }, []);

  const groupedSettings = useMemo(() => {
    const groups = new Map<SystemSettingItem["group"], SystemSettingItem[]>();
    for (const item of overview?.settings ?? []) {
      groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [overview]);
  const settings = overview?.settings ?? [];
  const configuredSettings = settings.filter((item) => item.status === "configured" || item.status === "enabled").length;
  const missingSettings = settings.filter((item) => item.status === "missing" || item.status === "disabled").length;

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">CONFIG</Typography.Text>
          <Typography.Title level={3}>系统设置</Typography.Title>
          <Typography.Text type="secondary">集中查看外部服务、存储、数据库和导出链路配置状态。</Typography.Text>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">配置项</Typography.Text>
          <strong>{settings.length}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">已配置</Typography.Text>
          <strong>{configuredSettings}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">待处理</Typography.Text>
          <strong>{missingSettings}</strong>
        </div>
      </section>

      <Card className="pas-panel" title="系统设置">
        {loading ? (
          <div className="system-loading">
            <Spin />
          </div>
        ) : (
          <div className="system-settings-grid">
            {groupedSettings.map(([group, items]) => (
              <Card className="system-subpanel" key={group} title={GROUP_TITLES[group]}>
                <Descriptions size="small" column={1}>
                  {items.map((item) => (
                    <Descriptions.Item
                      key={item.key}
                      label={
                        <span className="system-setting-label">
                          {item.label}
                          <Tag color={statusColor(item.status)}>{item.status}</Tag>
                        </span>
                      }
                    >
                      <Typography.Text>{item.value}</Typography.Text>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  async function refreshOverview(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setOverview(await api<SystemOverview>("/api/internal/system/overview"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "系统设置加载失败");
    } finally {
      setLoading(false);
    }
  }
}

function statusColor(status: SystemSettingItem["status"]): string {
  switch (status) {
    case "enabled":
    case "configured":
      return "green";
    case "missing":
    case "disabled":
      return "red";
    default:
      return "default";
  }
}
