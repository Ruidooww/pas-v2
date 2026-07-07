import { useEffect, useState } from "react";
import { Alert, Button, Card, message, Space, Tag, Typography } from "antd";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { PlainList as List } from "../components/PlainList";
import type { ExportDownloadResponse, ExportFormat, ExportJob } from "../types";

export function ExportJobsPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadJobs();
  }, []);

  const completed = jobs.filter((job) => job.status === "completed").length;
  const partial = jobs.filter((job) => job.status === "partial").length;
  const failed = jobs.filter((job) => job.status === "failed").length;

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">EXPORTS</Typography.Text>
          <Typography.Title level={2}>导出中心</Typography.Title>
          <Typography.Paragraph type="secondary">查看方案交付导出任务、格式状态和可下载文件。</Typography.Paragraph>
        </div>
        <div className="workbench-metric-grid">
          <div className="workbench-metric">
            <Typography.Text type="secondary">任务数</Typography.Text>
            <strong>{jobs.length}</strong>
            <Typography.Text type="secondary">当前可见</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">完成</Typography.Text>
            <strong>{completed}</strong>
            <Typography.Text type="secondary">全部格式可用</Typography.Text>
          </div>
          <div className="workbench-metric">
            <Typography.Text type="secondary">异常</Typography.Text>
            <strong>{partial + failed}</strong>
            <Typography.Text type="secondary">需检查模板或导出结果</Typography.Text>
          </div>
        </div>
      </section>

      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}

      <Card className="pas-panel" title="导出任务" loading={loading}>
        {jobs.length === 0 ? (
          <EmptyState
            title="暂无导出任务"
            description="从方案生成页发起导出后，会在这里看到 docx / pptx / xlsx 状态。"
          />
        ) : (
          <List
            dataSource={jobs}
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

function statusColor(status: ExportJob["status"]): string {
  if (status === "completed") return "green";
  if (status === "partial") return "orange";
  return "red";
}
