import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  message,
  Select,
  Space,
  Steps,
  Tag,
  Typography
} from "antd";
import { api } from "../api";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { PlainList as List } from "../components/PlainList";
import { loadCustomers } from "../customer-api";
import { buildDrilldownSearch, useDrilldownQuery } from "../drilldown";
import type {
  CrmCustomerSummary,
  CustomerAnalysisResult,
  ExportDownloadResponse,
  ExportFormat,
  ExportJob,
  ProposalJob,
  SecondaryMenuKey
} from "../types";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 200;
const proposalDrilldownSchema = { source: ["proposal"] } as const;

export type WorkbenchPageMode = "customerInsights" | "proposalTasks";

export function WorkbenchPage({
  mode = "customerInsights",
  onNavigate = () => undefined
}: {
  mode?: WorkbenchPageMode;
  onNavigate?: (key: SecondaryMenuKey, search?: string) => void;
}) {
  const [customers, setCustomers] = useState<CrmCustomerSummary[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<CustomerAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [proposalJob, setProposalJob] = useState<ProposalJob | null>(null);
  const [proposalJobs, setProposalJobs] = useState<ProposalJob[]>([]);
  const [loadingProposalJobs, setLoadingProposalJobs] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalDrilldown, updateProposalDrilldown] = useDrilldownQuery(proposalDrilldownSchema);
  const pollCount = useRef(0);
  const proposalProgressRef = useRef<HTMLDivElement>(null);
  const isCustomerInsights = mode === "customerInsights";
  const isProposalTasks = mode === "proposalTasks";

  useEffect(() => {
    loadCustomers()
      .then(({ customers }) => setCustomers(customers))
      .catch((err) => setError(err instanceof Error ? err.message : "客户列表加载失败"));
  }, []);

  const loadProposalJobs = async () => {
    if (!isProposalTasks) return;
    setLoadingProposalJobs(true);
    try {
      const jobs = await api<ProposalJob[]>("/api/internal/proposals");
      setProposalJobs(jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "方案任务加载失败");
    } finally {
      setLoadingProposalJobs(false);
    }
  };

  useEffect(() => {
    if (!isProposalTasks) return;
    void loadProposalJobs();
  }, [isProposalTasks]);

  const analyze = async () => {
    if (!customerId) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setProposalJob(null);
    setExportJob(null);
    try {
      const result = await api<CustomerAnalysisResult>("/api/internal/customer-analysis/analyze", {
        method: "POST",
        body: { customerId }
      });
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "客户分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const pollProposal = async (jobId: string): Promise<void> => {
    pollCount.current += 1;
    const job = await api<ProposalJob>(`/api/internal/proposals/${jobId}`);
    setProposalJob(job);
    if (job.status === "running" && pollCount.current < MAX_POLLS) {
      setTimeout(() => void pollProposal(jobId).catch(handlePollError), POLL_INTERVAL_MS);
    } else {
      setGenerating(false);
      void loadProposalJobs();
    }
  };

  const handlePollError = (err: unknown) => {
    setGenerating(false);
    setError(err instanceof Error ? err.message : "查询生成进度失败");
  };

  const showProposalProgress = (job: ProposalJob) => {
    flushSync(() => setProposalJob(job));
    proposalProgressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const generate = async () => {
    if (!customerId) return;
    setGenerating(true);
    setError(null);
    setExportJob(null);
    pollCount.current = 0;
    try {
      const job = await api<ProposalJob>("/api/internal/proposals/generate", {
        method: "POST",
        body: { customerId }
      });
      setProposalJob(job);
      await loadProposalJobs();
      setTimeout(() => void pollProposal(job.jobId).catch(handlePollError), POLL_INTERVAL_MS);
    } catch (err) {
      setGenerating(false);
      setError(err instanceof Error ? err.message : "方案生成启动失败");
    }
  };

  const startExport = async () => {
    if (!proposalJob?.exportPackage) return;
    setExporting(true);
    setError(null);
    try {
      const job = await api<ExportJob>("/api/internal/exports", {
        method: "POST",
        body: { exportPackage: proposalJob.exportPackage }
      });
      setExportJob(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const download = async (format: ExportFormat) => {
    if (!exportJob) return;
    try {
      const file = await api<ExportDownloadResponse>(
        `/api/internal/exports/${exportJob.jobId}/files/${format}`
      );
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
  };

  const draft = proposalJob?.draft;
  const selectedCustomer = customers.find((customer) => customer.customerId === customerId);
  const completedExports = exportJob?.formats.filter((format) => format.status === "completed").length ?? 0;
  const pageCopy = isCustomerInsights
    ? {
        eyebrow: "CUSTOMER INSIGHTS",
        title: "客户画像",
        tags: ["客户分析", "痛点识别", "切入建议"]
      }
    : {
        eyebrow: "PROPOSAL TASKS",
        title: "方案生成",
        tags: ["方案草稿", "交付导出", "人工审核"]
      };
  const workbenchMetrics = isCustomerInsights
    ? [
        { label: "客户池", value: String(customers.length), hint: "CRM 可选客户", target: "customer_management" as const },
        {
          label: "当前客户",
          value: selectedCustomer?.name ?? "未选择",
          hint: selectedCustomer ? `${selectedCustomer.industry} / ${selectedCustomer.region}` : "等待选择"
        },
        {
          label: "画像状态",
          value: analysis ? "已生成" : "未生成",
          hint: analysis?.analysisId ?? "待分析"
        }
      ]
    : [
        { label: "客户池", value: String(customers.length), hint: "CRM 可选客户", target: "customer_management" as const },
        {
          label: "方案任务",
          value: proposalJob ? statusText(proposalJob.status) : "未启动",
          hint: proposalJob?.jobId ?? "待生成"
        },
        {
          label: "导出包",
          value: exportJob ? `${completedExports}/${exportJob.formats.length}` : "未生成",
          hint: "docx / pptx / xlsx",
          target: exportJob ? ("export_jobs" as const) : undefined,
          search: exportJob ? buildDrilldownSearch({ result: "completed" }) : undefined
        }
      ];

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <section className="workbench-hero">
        <div className="workbench-hero-copy">
          <Typography.Text className="workbench-eyebrow">{pageCopy.eyebrow}</Typography.Text>
          <Typography.Title level={2}>{pageCopy.title}</Typography.Title>
          <div className="workbench-hero-tags">
            {pageCopy.tags.map((tag, index) => (
              <Tag color={index === 0 ? "blue" : index === 1 ? "geekblue" : "default"} key={tag}>
                {tag}
              </Tag>
            ))}
          </div>
        </div>
        <div className="workbench-metric-grid">
          {workbenchMetrics.map((metric) => (
            metric.target ? (
              <MetricDrilldown
                className="workbench-metric"
                key={metric.label}
                label={metric.label}
                onClick={() => metric.target && onNavigate(metric.target, metric.search)}
              >
                <Typography.Text type="secondary">{metric.label}</Typography.Text>
                <strong>{metric.value}</strong>
                <Typography.Text type="secondary">{metric.hint}</Typography.Text>
              </MetricDrilldown>
            ) : (
              <div className="workbench-metric" key={metric.label}>
                <Typography.Text type="secondary">{metric.label}</Typography.Text>
                <strong>{metric.value}</strong>
                <Typography.Text type="secondary">{metric.hint}</Typography.Text>
              </div>
            )
          ))}
        </div>
      </section>

      {isProposalTasks && proposalDrilldown.source === "proposal" && (
        <Space className="drilldown-filter-summary" wrap>
          <Tag color="blue">当前下钻：方案相关</Tag>
          <Button type="link" size="small" onClick={() => updateProposalDrilldown({})}>清除下钻</Button>
        </Space>
      )}

      <Card className="pas-panel pas-toolbar-panel" title={pageCopy.title}>
        <Space className="workbench-toolbar" wrap>
          <Select
            showSearch
            className="customer-select"
            placeholder="搜索或选择 CRM 客户"
            value={customerId}
            onChange={setCustomerId}
            optionFilterProp="label"
            options={customers.map((customer) => ({
              value: customer.customerId,
              label: `${customer.name}（${customer.industry} / ${customer.region}）`
            }))}
          />
          {isCustomerInsights && (
            <Button type="primary" onClick={() => void analyze()} loading={analyzing} disabled={!customerId}>
              生成客户画像
            </Button>
          )}
          {isProposalTasks && (
            <Button type="primary" onClick={() => void generate()} loading={generating} disabled={!customerId}>
              生成方案
            </Button>
          )}
        </Space>
      </Card>

      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}

      {isCustomerInsights && analysis && (
        <Card className="pas-panel" title={`客户情况分析：${analysis.customerName}`}>
          <Alert type="warning" title="AI 生成内容，需人工核实后使用" showIcon style={{ marginBottom: 12 }} />
          {analysis.narrativeSummary && (
            <Typography.Paragraph strong style={{ whiteSpace: "pre-wrap" }}>
              {analysis.narrativeSummary}
              <Tag style={{ marginLeft: 8 }} color={analysis.narrativeSource === "llm" ? "blue" : "default"}>
                {analysis.narrativeSource === "llm" ? "LLM 提炼" : "规则生成"}
              </Tag>
            </Typography.Paragraph>
          )}
          <Descriptions className="analysis-descriptions" column={1} size="small">
            <Descriptions.Item label="痛点">
              {analysis.painPoints.map((item) => item.title).join("；")}
            </Descriptions.Item>
            <Descriptions.Item label="风险">
              {analysis.risks.map((item) => item.title).join("；")}
            </Descriptions.Item>
            <Descriptions.Item label="切入角度">
              {analysis.entryAngles.map((item) => item.title).join("；")}
            </Descriptions.Item>
            <Descriptions.Item label="推荐能力">
              {analysis.recommendedCapabilities.map((item) => item.title).join("；")}
            </Descriptions.Item>
            <Descriptions.Item label="知识库证据">{analysis.evidence.length} 条</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {isProposalTasks && proposalJob && (
        <div ref={proposalProgressRef} style={{ scrollMarginTop: 88 }}>
          <Card className="pas-panel" title="方案生成进度">
            <Steps
              size="small"
              orientation="vertical"
              items={proposalJob.progress.map((record) => ({
                title: record.message,
                status:
                  record.status === "failed" ? "error" : record.status === "completed" ? "finish" : "process",
                description: record.at
              }))}
            />
            {proposalJob.status === "failed" && (
              <Alert type="error" title={`生成失败：${proposalJob.failureReason ?? "未知原因"}`} />
            )}
          </Card>
        </div>
      )}

      {isProposalTasks && (
        <Card className="pas-panel" title="最近方案任务" loading={loadingProposalJobs}>
          {proposalJobs.length === 0 ? (
            <Typography.Text type="secondary">暂无方案任务</Typography.Text>
          ) : (
            <div className="proposal-job-list">
              {proposalJobs.map((job) => {
                const latestProgress = job.progress[job.progress.length - 1];
                return (
                  <div className="proposal-job-list-item" key={job.jobId}>
                    <Space className="proposal-job-row" direction="vertical" size={4}>
                      <Space wrap>
                        <Typography.Text strong>{job.request.customerId}</Typography.Text>
                        <Tag color={statusColor(job.status)}>{statusText(job.status)}</Tag>
                      </Space>
                      <Typography.Text type="secondary">{job.jobId}</Typography.Text>
                      <Typography.Text type="secondary">
                        {(latestProgress?.message ?? "暂无进度") + " · " + formatDateTime(job.updatedAt)}
                      </Typography.Text>
                    </Space>
                    <Button size="small" onClick={() => showProposalProgress(job)}>
                      查看进度
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {isProposalTasks && draft && (
        <Card
          className="pas-panel"
          title={draft.title}
          extra={
            <Space>
              <Button type="primary" onClick={() => void startExport()} loading={exporting}>
                导出 docx / pptx / xlsx
              </Button>
            </Space>
          }
        >
          <Alert type="warning" title="方案草稿需售前人工审核后才能对客户使用" showIcon style={{ marginBottom: 12 }} />
          <Collapse
            items={draft.sections.map((section) => ({
              key: section.sectionId,
              label: section.title,
              children: (
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{section.body}</Typography.Paragraph>
              )
            }))}
          />
          {exportJob && (
            <List
              header="导出结果（临时模板生成，正式模板到位后自动替换样式）"
              className="export-list"
              style={{ marginTop: 16 }}
              size="small"
              dataSource={exportJob.formats}
              renderItem={(record) => (
                <List.Item
                  actions={
                    record.status === "completed"
                      ? [
                          <Button key="dl" size="small" onClick={() => void download(record.format)}>
                            下载 {record.format}
                          </Button>
                        ]
                      : undefined
                  }
                >
                  <Space>
                    <Tag color={record.status === "completed" ? "green" : "red"}>{record.format}</Tag>
                    {record.status === "completed" ? record.fileName : record.errorMessage}
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
      )}
    </Space>
  );
}

function statusText(status: ProposalJob["status"]): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "running":
      return "生成中";
    default:
      return "排队中";
  }
}

function statusColor(status: ProposalJob["status"]): string {
  switch (status) {
    case "completed":
      return "green";
    case "failed":
      return "red";
    case "running":
      return "blue";
    default:
      return "default";
  }
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}
