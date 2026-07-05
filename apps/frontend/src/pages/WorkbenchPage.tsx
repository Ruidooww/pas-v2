import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  List,
  message,
  Select,
  Space,
  Steps,
  Tag,
  Typography
} from "antd";
import { api } from "../api";
import type {
  CrmCustomerSummary,
  CustomerAnalysisResult,
  ExportDownloadResponse,
  ExportFormat,
  ExportJob,
  ProposalJob
} from "../types";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 200;

export function WorkbenchPage() {
  const [customers, setCustomers] = useState<CrmCustomerSummary[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<CustomerAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [proposalJob, setProposalJob] = useState<ProposalJob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    api<{ customers: CrmCustomerSummary[] }>("/api/crm/customers")
      .then((response) => setCustomers(response.customers))
      .catch((err) => setError(err instanceof Error ? err.message : "客户列表加载失败"));
  }, []);

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
    }
  };

  const handlePollError = (err: unknown) => {
    setGenerating(false);
    setError(err instanceof Error ? err.message : "查询生成进度失败");
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

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <Card className="pas-panel pas-toolbar-panel" title="选择客户">
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
          <Button type="primary" onClick={() => void analyze()} loading={analyzing} disabled={!customerId}>
            生成客户分析
          </Button>
          <Button onClick={() => void generate()} loading={generating} disabled={!customerId}>
            一键生成方案
          </Button>
        </Space>
      </Card>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} />}

      {analysis && (
        <Card className="pas-panel" title={`客户情况分析：${analysis.customerName}`}>
          <Alert type="warning" message="AI 生成内容，需人工核实后使用" showIcon style={{ marginBottom: 12 }} />
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

      {proposalJob && (
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
            <Alert type="error" message={`生成失败：${proposalJob.failureReason ?? "未知原因"}`} />
          )}
        </Card>
      )}

      {draft && (
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
          <Alert type="warning" message="方案草稿需售前人工审核后才能对客户使用" showIcon style={{ marginBottom: 12 }} />
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
