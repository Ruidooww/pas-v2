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
  const paths = overview?.paths ?? [];
  const missingPaths = paths.filter((item) => !item.exists).length;
  const totalFiles = paths.reduce((total, item) => total + item.fileCount, 0);
  const totalBytes = paths.reduce((total, item) => total + item.totalBytes, 0);

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">STORAGE</Typography.Text>
          <Typography.Title level={3}>数据与附件</Typography.Title>
          <Typography.Text type="secondary">检查导出文件、附件目录和运行期数据路径是否可用。</Typography.Text>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">路径数</Typography.Text>
          <strong>{paths.length}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">文件数</Typography.Text>
          <strong>{totalFiles}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">缺失路径</Typography.Text>
          <strong>{missingPaths}</strong>
        </div>
      </section>

      <Card className="pas-panel" title="数据与附件">
        {loading ? (
          <div className="system-loading">
            <Spin />
          </div>
        ) : (
          <div className="system-path-grid">
            {paths.map((item) => (
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
      {!loading && (
        <Typography.Text className="system-footnote" type="secondary">
          当前路径总占用 {formatBytes(totalBytes)}
        </Typography.Text>
      )}
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
