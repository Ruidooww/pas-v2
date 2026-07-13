import { useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Space, Spin, Statistic, Tag, Typography } from "antd";
import { api } from "../api";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { useDrilldownQuery } from "../drilldown";
import type { SystemOverview } from "../types";

const pathDrilldownSchema = { paths: ["all", "with_files", "missing"] } as const;

export function DataAttachmentsPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [drilldown, updateDrilldown] = useDrilldownQuery(pathDrilldownSchema);

  useEffect(() => {
    void refreshOverview();
  }, []);
  const paths = overview?.paths ?? [];
  const missingPaths = paths.filter((item) => !item.exists).length;
  const totalFiles = paths.reduce((total, item) => total + item.fileCount, 0);
  const totalBytes = paths.reduce((total, item) => total + item.totalBytes, 0);
  const visiblePaths = filterPaths(paths, drilldown.paths);
  const activeFilter = pathFilterLabel(drilldown.paths);

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">STORAGE</Typography.Text>
          <Typography.Title level={3}>数据与附件</Typography.Title>
          <Typography.Text type="secondary">检查导出文件、附件目录和运行期数据路径是否可用。</Typography.Text>
        </div>
        <MetricDrilldown className="system-hero-stat" label="路径数" onClick={() => updateDrilldown({ paths: "all" })}>
          <Typography.Text type="secondary">路径数</Typography.Text>
          <strong>{paths.length}</strong>
        </MetricDrilldown>
        <MetricDrilldown className="system-hero-stat" label="文件数" onClick={() => updateDrilldown({ paths: "with_files" })}>
          <Typography.Text type="secondary">文件数</Typography.Text>
          <strong>{totalFiles}</strong>
        </MetricDrilldown>
        <MetricDrilldown className="system-hero-stat" label="缺失路径" onClick={() => updateDrilldown({ paths: "missing" })}>
          <Typography.Text type="secondary">缺失路径</Typography.Text>
          <strong>{missingPaths}</strong>
        </MetricDrilldown>
      </section>

      {activeFilter && (
        <Space className="drilldown-filter-summary" wrap>
          <Tag color="blue">当前筛选：{activeFilter}</Tag>
          <Button type="link" size="small" onClick={() => updateDrilldown({})}>清除筛选</Button>
        </Space>
      )}

      <Card className="pas-panel" title="数据与附件">
        {loading ? (
          <div className="system-loading">
            <Spin />
          </div>
        ) : (
          <div className="system-path-grid">
            {visiblePaths.map((item) => (
              <Card className={`system-subpanel${selectedPath === item.label ? " is-selected" : ""}`} key={item.label}>
                <div className="system-path-header">
                  <Typography.Text strong>{item.label}</Typography.Text>
                  <Space size={6}>
                    {selectedPath === item.label && <Tag color="blue">已选择</Tag>}
                    <Tag color={item.exists ? "green" : "red"}>{item.exists ? "exists" : "missing"}</Tag>
                  </Space>
                </div>
                <div className="system-stat-grid">
                  <MetricDrilldown className="system-path-stat" label={`${item.label}文件数`} onClick={() => setSelectedPath(item.label)}>
                    <Statistic title="文件数" value={item.fileCount} suffix={item.truncated ? "+" : undefined} />
                  </MetricDrilldown>
                  <MetricDrilldown className="system-path-stat" label={`${item.label}总大小`} onClick={() => setSelectedPath(item.label)}>
                    <Statistic title="总大小" value={formatBytes(item.totalBytes)} />
                  </MetricDrilldown>
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

function filterPaths(paths: SystemOverview["paths"], filter?: string): SystemOverview["paths"] {
  if (filter === "with_files") return paths.filter((item) => item.fileCount > 0);
  if (filter === "missing") return paths.filter((item) => !item.exists);
  return paths;
}

function pathFilterLabel(filter?: string): string | undefined {
  if (filter === "all") return "全部路径";
  if (filter === "with_files") return "含文件路径";
  if (filter === "missing") return "缺失路径";
  return undefined;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
