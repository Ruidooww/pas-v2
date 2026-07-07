import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Select, Space, Tag, Typography } from "antd";
import { ReloadOutlined, StopOutlined } from "@ant-design/icons";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import type { KnowledgeDocument, KnowledgeDocumentMaterialType, KnowledgeDocumentParseStatus } from "../types";

const parseStatusOptions: Array<{ label: string; value: KnowledgeDocumentParseStatus | "all" }> = [
  { label: "全部", value: "all" },
  { label: "待解析", value: "pending" },
  { label: "解析中", value: "parsing" },
  { label: "已完成", value: "done" },
  { label: "失败", value: "failed" }
];

const materialTypeOptions: Array<{ label: string; value: KnowledgeDocumentMaterialType }> = [
  { label: "PDF", value: "pdf" },
  { label: "PPTX", value: "pptx" },
  { label: "DOCX", value: "docx" },
  { label: "XLSX", value: "xlsx" },
  { label: "图片", value: "image" },
  { label: "扫描件", value: "scan" },
  { label: "其他", value: "other" }
];

export function KnowledgeDocumentsPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [parseStatus, setParseStatus] = useState<KnowledgeDocumentParseStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    documentId: "",
    title: "",
    product: "IP-Guard",
    materialType: "pdf" as KnowledgeDocumentMaterialType,
    sourceName: "",
    tags: ""
  });

  const listPath = useMemo(() => {
    if (parseStatus === "all") {
      return "/api/internal/knowledge-documents";
    }
    return `/api/internal/knowledge-documents?parseStatus=${encodeURIComponent(parseStatus)}`;
  }, [parseStatus]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      setDocuments(await api<KnowledgeDocument[]>(listPath));
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "文档列表加载失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, [listPath]);

  const registerDocument = async () => {
    if (!form.documentId.trim() || !form.title.trim() || !form.sourceName.trim()) return;
    setSaving(true);
    try {
      await api<KnowledgeDocument>("/api/internal/knowledge-documents", {
        method: "POST",
        body: {
          documentId: form.documentId.trim(),
          title: form.title.trim(),
          product: form.product.trim(),
          materialType: form.materialType,
          sourceName: form.sourceName.trim(),
          parseStatus: "pending",
          visibility: { scope: "public" },
          tags: form.tags
            .split(/[,\s，]+/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        }
      });
      setForm({ documentId: "", title: "", product: "IP-Guard", materialType: "pdf", sourceName: "", tags: "" });
      setNotice({ type: "success", text: "文档元数据已登记" });
      await loadDocuments();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "登记失败" });
    } finally {
      setSaving(false);
    }
  };

  const mutate = async (path: string, body?: unknown) => {
    try {
      await api(path, { method: "POST", body });
      await loadDocuments();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "操作失败" });
    }
  };

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <Card className="pas-panel pas-toolbar-panel" title="文档运营">
        <Space className="knowledge-toolbar" wrap>
          <Select
            value={parseStatus}
            onChange={setParseStatus}
            options={parseStatusOptions}
            style={{ minWidth: 132 }}
          />
          <Input
            value={form.documentId}
            onChange={(event) => setForm((current) => ({ ...current, documentId: event.target.value }))}
            placeholder="RAGFlow document id"
            style={{ width: 190 }}
          />
          <Input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="文档标题"
            style={{ width: 220 }}
          />
          <Input
            value={form.product}
            onChange={(event) => setForm((current) => ({ ...current, product: event.target.value }))}
            placeholder="产品"
            style={{ width: 140 }}
          />
          <Select
            value={form.materialType}
            onChange={(value) => setForm((current) => ({ ...current, materialType: value }))}
            options={materialTypeOptions}
            style={{ width: 120 }}
          />
        </Space>
        <Space className="knowledge-toolbar" wrap>
          <Input
            value={form.sourceName}
            onChange={(event) => setForm((current) => ({ ...current, sourceName: event.target.value }))}
            placeholder="源文件名"
            style={{ width: 220 }}
          />
          <Input
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            placeholder="标签，用空格或逗号分隔"
            style={{ width: 280 }}
          />
          <Button type="primary" loading={saving} onClick={() => void registerDocument()}>
            登记文档
          </Button>
        </Space>
      </Card>

      {notice && <Alert type={notice.type} title={notice.text} closable onClose={() => setNotice(null)} />}

      <Card className="pas-panel" title="文档列表" loading={loading}>
        {documents.length === 0 ? (
          <EmptyState title="暂无文档元数据" description="当前仅登记 PAS 侧索引；真实资料仍在 RAGFlow 控制台维护。" />
        ) : (
          <div className="knowledge-list">
            {documents.map((document) => (
              <div className="knowledge-list-item" key={document.documentId}>
                <div className="knowledge-list-content">
                  <Space wrap>
                    <Typography.Text strong>{document.title}</Typography.Text>
                    <Tag color={parseStatusColor(document.parseStatus)}>{document.parseStatus}</Tag>
                    <Tag color={document.enabled ? "green" : "red"}>
                      {document.enabled ? "enabled" : "disabled"}
                    </Tag>
                    <Tag>{document.visibility.scope}</Tag>
                    <Typography.Text type="secondary">
                      {document.product} / {document.materialType} / {document.sourceName}
                    </Typography.Text>
                  </Space>
                  <Space className="knowledge-block-body" orientation="vertical" size={6}>
                    <Space wrap>
                      <Tag>{document.chunkCount} chunks</Tag>
                      <Tag>{document.hitCount} hits</Tag>
                      <Tag>{document.badFeedbackCount} bad feedback</Tag>
                    </Space>
                    <Space wrap>
                      {document.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                    {document.failureReason && (
                      <Typography.Text type="danger">{document.failureReason}</Typography.Text>
                    )}
                  </Space>
                </div>
                <Space className="knowledge-list-actions" wrap>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() =>
                      void mutate(`/api/internal/knowledge-documents/${document.documentId}/reparse`, {
                        reason: "manual reparse"
                      })
                    }
                  >
                    重跑解析
                  </Button>
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    onClick={() =>
                      void mutate(`/api/internal/knowledge-documents/${document.documentId}/enabled`, {
                        enabled: !document.enabled,
                        reason: document.enabled ? "manual disable" : undefined
                      })
                    }
                  >
                    {document.enabled ? "禁用" : "启用"}
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

function parseStatusColor(status: KnowledgeDocumentParseStatus): string {
  if (status === "done") return "green";
  if (status === "parsing" || status === "pending") return "blue";
  return "red";
}
