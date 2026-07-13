import { useEffect, useState } from "react";
import { Alert, Button, Card, message, Space, Tag, Typography } from "antd";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { PlainList as List } from "../components/PlainList";
import { useDrilldownQuery } from "../drilldown";
import type { ExportDownloadResponse, ExportFormat, ExportJob } from "../types";

const exportDrilldownSchema = { result: ["all", "completed", "abnormal"] } as const;

export function ExportJobsPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, updateDrilldown] = useDrilldownQuery(exportDrilldownSchema);

  useEffect(() => {
    void loadJobs();
  }, []);

  const completed = jobs.filter((job) => job.status === "completed").length;
  const partial = jobs.filter((job) => job.status === "partial").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const visibleJobs = filterExportJobs(jobs, drilldown.result);
  const activeFilter = exportFilterLabel(drilldown.result);

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">EXPORTS</Typography.Text>
          <Typography.Title level={2}>导出中心</Typography.Title>
          <Typography.Paragraph type="secondary">查看方案交付导出任务、格式状态和可下载文件。</Typography.Paragraph>
        </div>
        <div className="workbench-metric-grid">
          <MetricDrilldown className="workbench-metric" label="任务数" onClick={() => updateDrilldown({ result: "all" })}>
            <Typography.Text type="secondary">任务数</Typography.Text>
            <strong>{jobs.length}</strong>
            <Typography.Text type="secondary">当前可见</Typography.Text>
          </MetricDrilldown>
          <MetricDrilldown className="workbench-metric" label="完成" onClick={() => updateDrilldown({ result: "completed" })}>
            <Typography.Text type="secondary">完成</Typography.Text>
            <strong>{completed}</strong>
            <Typography.Text type="secondary">全部格式可用</Typography.Text>
          </MetricDrilldown>
          <MetricDrilldown className="workbench-metric" label="异常" onClick={() => updateDrilldown({ result: "abnormal" })}>
            <Typography.Text type="secondary">异常</Typography.Text>
            <strong>{partial + failed}</strong>
            <Typography.Text type="secondary">需检查模板或导出结果</Typography.Text>
          </MetricDrilldown>
        </div>
      </section>

      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}

      {activeFilter && (
        <Space className="drilldown-filter-summary" wrap>
          <Tag color="blue">当前筛选：{activeFilter}</Tag>
          <Button type="link" size="small" onClick={() => updateDrilldown({})}>清除筛选</Button>
        </Space>
      )}

      <Card className="pas-panel" title="导出任务" loading={loading}>
        {jobs.length === 0 ? (
          <EmptyState
            title="暂无导出任务"
            description="从方案生成页发起导出后，会在这里看到 docx / pptx / xlsx 状态。"
          />
        ) : (
          <List
            dataSource={visibleJobs}
            renderItem={(job) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Typography.Text strong>{job.jobId}</Typography.Text>
                      <Tag color={statusColor(job.status)}>{job.status}</Tag>
                      <Typography.Text type="secondary">{job.updatedAt}</Typography.Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={6}>
                      <Typography.Text type="secondary">
                        {job.customerId} / {job.sourcePackageId}
                      </Typography.Text>
                      <Space wrap>
                        {job.formats.map((record) => (
                          <Tag color={record.status === "completed" ? "green" : "red"} key={record.format}>
                            {record.format}
                          </Tag>
                        ))}
                      </Space>
                    </Space>
                  }
                />
                <Space wrap>
                  {job.formats
                    .filter((record) => record.status === "completed")
                    .map((record) => (
                      <Button
                        key={record.format}
                        size="small"
                        onClick={() => void download(job.jobId, record.format)}
                      >
                        下载 {record.format}
                      </Button>
                    ))}
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );

  async function loadJobs(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setJobs(await api<ExportJob[]>("/api/internal/exports"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出任务加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function download(jobId: string, format: ExportFormat): Promise<void> {
    try {
      const file = await api<ExportDownloadResponse>(`/api/internal/exports/${jobId}/files/${format}`);
      const bytes = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "下载失败");
    }
  }
}

function filterExportJobs(jobs: ExportJob[], result?: string): ExportJob[] {
  if (result === "completed") return jobs.filter((job) => job.status === "completed");
  if (result === "abnormal") return jobs.filter((job) => job.status === "partial" || job.status === "failed");
  return jobs;
}

function exportFilterLabel(result?: string): string | undefined {
  if (result === "all") return "全部任务";
  if (result === "completed") return "已完成";
  if (result === "abnormal") return "异常";
  return undefined;
}

function statusColor(status: ExportJob["status"]): string {
  if (status === "completed") return "green";
  if (status === "partial") return "orange";
  return "red";
}
