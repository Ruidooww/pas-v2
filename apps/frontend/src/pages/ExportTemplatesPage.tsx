import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Select, Space, Tag, Typography } from "antd";
import { CheckCircleOutlined, StopOutlined } from "@ant-design/icons";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import type { ExportFormat, ExportTemplate, ExportTemplateStatus } from "../types";

const formatOptions: Array<{ label: string; value: ExportFormat | "all" }> = [
  { label: "全部", value: "all" },
  { label: "DOCX", value: "docx" },
  { label: "PPTX", value: "pptx" },
  { label: "XLSX", value: "xlsx" }
];

const statusOptions: Array<{ label: string; value: ExportTemplateStatus | "all" }> = [
  { label: "全部", value: "all" },
  { label: "草稿", value: "draft" },
  { label: "启用", value: "active" },
  { label: "停用", value: "disabled" }
];

export function ExportTemplatesPage() {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [format, setFormat] = useState<ExportFormat | "all">("all");
  const [status, setStatus] = useState<ExportTemplateStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    templateId: "",
    name: "",
    format: "docx" as ExportFormat,
    version: "",
    fileName: "",
    products: "IP-Guard",
    scenarios: "standard proposal",
    tags: ""
  });

  const listPath = useMemo(() => {
    const params = new URLSearchParams();
    if (format !== "all") params.set("format", format);
    if (status !== "all") params.set("status", status);
    const query = params.toString();
    return query ? `/api/internal/export-templates?${query}` : "/api/internal/export-templates";
  }, [format, status]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      setTemplates(await api<ExportTemplate[]>(listPath));
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "模板列表加载失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, [listPath]);

  const registerTemplate = async () => {
    if (!form.templateId.trim() || !form.name.trim() || !form.version.trim() || !form.fileName.trim()) return;
    setSaving(true);
    try {
      await api<ExportTemplate>("/api/internal/export-templates", {
        method: "POST",
        body: {
          templateId: form.templateId.trim(),
          name: form.name.trim(),
          category: "proposal",
          format: form.format,
          version: form.version.trim(),
          fileName: form.fileName.trim(),
          status: "draft",
          products: splitTextList(form.products),
          scenarios: splitTextList(form.scenarios),
          industries: [],
          tags: splitTextList(form.tags)
        }
      });
      setForm({
        templateId: "",
        name: "",
        format: "docx",
        version: "",
        fileName: "",
        products: "IP-Guard",
        scenarios: "standard proposal",
        tags: ""
      });
      setNotice({ type: "success", text: "模板元数据已登记" });
      await loadTemplates();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "登记失败" });
    } finally {
      setSaving(false);
    }
  };

  const setTemplateStatus = async (template: ExportTemplate, nextStatus: ExportTemplateStatus) => {
    try {
      await api(`/api/internal/export-templates/${template.templateId}/status`, {
        method: "POST",
        body: {
          status: nextStatus,
          reason: nextStatus === "disabled" ? "manual disable" : undefined
        }
      });
      await loadTemplates();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "状态更新失败" });
    }
  };

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <Card className="pas-panel pas-toolbar-panel" title="模板运营">
        <Space className="knowledge-toolbar" wrap>
          <Select value={format} onChange={setFormat} options={formatOptions} style={{ width: 116 }} />
          <Select value={status} onChange={setStatus} options={statusOptions} style={{ width: 116 }} />
          <Input
            value={form.templateId}
            onChange={(event) => setForm((current) => ({ ...current, templateId: event.target.value }))}
            placeholder="template id"
            style={{ width: 170 }}
          />
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="模板名称"
            style={{ width: 180 }}
          />
          <Select
            value={form.format}
            onChange={(value) => setForm((current) => ({ ...current, format: value }))}
            options={formatOptions.filter((option) => option.value !== "all") as Array<{ label: string; value: ExportFormat }>}
            style={{ width: 104 }}
          />
        </Space>
        <Space className="knowledge-toolbar" wrap>
          <Input
            value={form.version}
            onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
            placeholder="版本"
            style={{ width: 120 }}
          />
          <Input
            value={form.fileName}
            onChange={(event) => setForm((current) => ({ ...current, fileName: event.target.value }))}
            placeholder="模板文件名"
            style={{ width: 190 }}
          />
          <Input
            value={form.products}
            onChange={(event) => setForm((current) => ({ ...current, products: event.target.value }))}
            placeholder="产品"
            style={{ width: 150 }}
          />
          <Input
            value={form.scenarios}
            onChange={(event) => setForm((current) => ({ ...current, scenarios: event.target.value }))}
            placeholder="适用场景"
            style={{ width: 180 }}
          />
          <Input
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            placeholder="标签"
            style={{ width: 150 }}
          />
          <Button type="primary" loading={saving} onClick={() => void registerTemplate()}>
            登记模板
          </Button>
        </Space>
      </Card>

      {notice && <Alert type={notice.type} title={notice.text} closable onClose={() => setNotice(null)} />}

      <Card className="pas-panel" title="模板列表" loading={loading}>
        {templates.length === 0 ? (
          <EmptyState title="暂无模板元数据" description="正式模板上传前，可先登记模板文件名、版本和适用场景。" />
        ) : (
          <div className="knowledge-list">
            {templates.map((template) => (
              <div className="knowledge-list-item" key={template.templateId}>
                <div className="knowledge-list-content">
                  <Space wrap>
                    <Typography.Text strong>{template.name}</Typography.Text>
                    <Tag color={formatColor(template.format)}>{template.format}</Tag>
                    <Tag color={statusColor(template.status)}>{template.status}</Tag>
                    <Tag>{template.version}</Tag>
                    <Typography.Text type="secondary">{template.fileName}</Typography.Text>
                  </Space>
                  <Space className="knowledge-block-body" orientation="vertical" size={6}>
                    <Space wrap>
                      {template.products.map((product) => (
                        <Tag key={product}>{product}</Tag>
                      ))}
                      {template.scenarios.map((scenario) => (
                        <Tag key={scenario}>{scenario}</Tag>
                      ))}
                    </Space>
                    <Space wrap>
                      {template.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                    {template.disabledReason && (
                      <Typography.Text type="danger">{template.disabledReason}</Typography.Text>
                    )}
                  </Space>
                </div>
                <Space className="knowledge-list-actions" wrap>
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    disabled={template.status === "active"}
                    onClick={() => void setTemplateStatus(template, "active")}
                  >
                    启用
                  </Button>
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    disabled={template.status === "disabled"}
                    onClick={() => void setTemplateStatus(template, "disabled")}
                  >
                    停用
                  </Button>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Space>
  );
}

function splitTextList(value: string): string[] {
  return value
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatColor(format: ExportFormat): string {
  if (format === "docx") return "blue";
  if (format === "pptx") return "purple";
  return "green";
}

function statusColor(status: ExportTemplateStatus): string {
  if (status === "active") return "green";
  if (status === "draft") return "blue";
  return "red";
}
