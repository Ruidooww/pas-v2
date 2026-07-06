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

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />}
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
