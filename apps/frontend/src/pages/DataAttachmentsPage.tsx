import { useEffect, useState } from "react";
import { Alert, Card, Descriptions, Spin, Statistic, Tag, Typography } from "antd";
import { api } from "../api";
import type { SystemOverview } from "../types";

export function DataAttachmentsPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshOverview();
  }, []);

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />}
      <Card className="pas-panel" title="数据与附件">
        {loading ? (
          <div className="system-loading">
            <Spin />
          </div>
        ) : (
          <div className="system-path-grid">
            {(overview?.paths ?? []).map((item) => (
              <Card className="system-subpanel" key={item.label}>
                <div className="system-path-header">
                  <Typography.Text strong>{item.label}</Typography.Text>
                  <Tag color={item.exists ? "green" : "red"}>{item.exists ? "exists" : "missing"}</Tag>
                </div>
                <div className="system-stat-grid">
                  <Statistic title="文件数" value={item.fileCount} suffix={item.truncated ? "+" : undefined} />
                  <Statistic title="总大小" value={formatBytes(item.totalBytes)} />
                  <Statistic title="可写" value={item.writable ? "yes" : "no"} />
                </div>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="路径">{item.path}</Descriptions.Item>
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
      setError(err instanceof Error ? err.message : "数据状态加载失败");
    } finally {
      setLoading(false);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
