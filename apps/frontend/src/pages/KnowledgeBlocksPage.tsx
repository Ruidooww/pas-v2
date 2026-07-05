import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Input, Select, Space, Tag, Typography } from "antd";
import { CheckOutlined, CloseOutlined, CloudUploadOutlined, StopOutlined } from "@ant-design/icons";
import { api } from "../api";
import type { KnowledgeBlock, KnowledgeBlockStatus } from "../types";

const statusOptions: Array<{ label: string; value: KnowledgeBlockStatus | "all" }> = [
  { label: "全部", value: "all" },
  { label: "草稿", value: "draft" },
  { label: "待审核", value: "pending_review" },
  { label: "已发布", value: "published" },
  { label: "已驳回", value: "rejected" },
  { label: "已禁用", value: "disabled" }
];

export function KnowledgeBlocksPage() {
  const [blocks, setBlocks] = useState<KnowledgeBlock[]>([]);
  const [status, setStatus] = useState<KnowledgeBlockStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    product: "IP-Guard",
    scenario: "",
    body: "",
    tags: ""
  });

  const listPath = useMemo(() => {
    if (status === "all") {
      return "/api/internal/knowledge-blocks";
    }
    return `/api/internal/knowledge-blocks?status=${encodeURIComponent(status)}`;
  }, [status]);

  const loadBlocks = async () => {
    setLoading(true);
    setError(null);
    try {
      setBlocks(await api<KnowledgeBlock[]>(listPath));
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识块加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBlocks();
  }, [listPath]);

  const createDraft = async () => {
    if (!draft.title.trim() || !draft.scenario.trim() || !draft.body.trim()) return;
    setSaving(true);
    try {
      await api<KnowledgeBlock>("/api/internal/knowledge-blocks", {
        method: "POST",
        body: {
          title: draft.title.trim(),
          product: draft.product.trim(),
          scenario: draft.scenario.trim(),
          body: draft.body.trim(),
          tags: draft.tags
            .split(/[,\s，]+/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          source: { type: "manual" }
        }
      });
      setDraft({ title: "", product: "IP-Guard", scenario: "", body: "", tags: "" });
      setNotice({ type: "success", text: "知识块草稿已创建" });
      await loadBlocks();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
    } finally {
      setSaving(false);
    }
  };

  const mutate = async (path: string, body?: unknown) => {
    try {
      await api(path, { method: "POST", body });
      await loadBlocks();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "操作失败" });
    }
  };

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <Card className="pas-panel pas-toolbar-panel" title="知识块运营">
        <Space className="knowledge-toolbar" wrap>
          <Select
            value={status}
            onChange={setStatus}
            options={statusOptions}
            style={{ minWidth: 132 }}
          />
          <Input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="知识块标题"
            style={{ width: 220 }}
          />
          <Input
            value={draft.product}
            onChange={(event) => setDraft((current) => ({ ...current, product: event.target.value }))}
            placeholder="产品"
            style={{ width: 140 }}
          />
          <Input
            value={draft.scenario}
            onChange={(event) => setDraft((current) => ({ ...current, scenario: event.target.value }))}
            placeholder="场景"
            style={{ width: 140 }}
          />
        </Space>
        <Input.TextArea
          className="knowledge-draft-body"
          value={draft.body}
          onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
          placeholder="输入可审核、可发布的知识块正文"
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
        <Space className="knowledge-toolbar" wrap>
          <Input
            value={draft.tags}
            onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
            placeholder="标签，用空格或逗号分隔"
            style={{ width: 280 }}
          />
          <Button type="primary" loading={saving} onClick={() => void createDraft()}>
            新建草稿
          </Button>
        </Space>
      </Card>

      {error && <Alert type="error" title={error} closable onClose={() => setError(null)} />}
      {notice && <Alert type={notice.type} title={notice.text} closable onClose={() => setNotice(null)} />}

      <Card className="pas-panel" title="知识块列表" loading={loading}>
        {blocks.length === 0 ? (
          <Empty description="暂无知识块" />
        ) : (
          <div className="knowledge-list">
            {blocks.map((block) => (
              <div className="knowledge-list-item" key={block.blockId}>
                <div className="knowledge-list-content">
                  <Space wrap>
                    <Typography.Text strong>{block.title}</Typography.Text>
                    <Tag color={statusColor(block.status)}>{block.status}</Tag>
                    <Typography.Text type="secondary">
                      {block.product} / {block.scenario}
                    </Typography.Text>
                  </Space>
                  <Space className="knowledge-block-body" orientation="vertical" size={6}>
                    <Typography.Paragraph>{block.body}</Typography.Paragraph>
                    <Space wrap>
                      {block.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Space>
                    {block.citations.length > 0 && (
                      <Space orientation="vertical" size={2}>
                        {block.citations.map((citation) => (
                          <Typography.Text key={citation.chunkId} type="secondary">
                            {citation.title} · {citation.source}
                            {citation.page !== undefined ? ` · p.${citation.page}` : ""}
                            {citation.section ? ` · ${citation.section}` : ""}
                            {citation.snippet ? ` · ${citation.snippet}` : ""}
                          </Typography.Text>
                        ))}
                      </Space>
                    )}
                  </Space>
                </div>
                <Space className="knowledge-list-actions" wrap>
                  <Button
                    size="small"
                    icon={<CloudUploadOutlined />}
                    disabled={block.status !== "draft" && block.status !== "rejected"}
                    onClick={() => void mutate(`/api/internal/knowledge-blocks/${block.blockId}/submit-review`)}
                  >
                    提审
                  </Button>
                  <Button
                    size="small"
                    icon={<CheckOutlined />}
                    disabled={block.status !== "pending_review"}
                    onClick={() =>
                      void mutate(`/api/internal/knowledge-blocks/${block.blockId}/review`, { decision: "approve" })
                    }
                  >
                    通过
                  </Button>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    disabled={block.status !== "pending_review"}
                    onClick={() =>
                      void mutate(`/api/internal/knowledge-blocks/${block.blockId}/review`, {
                        decision: "reject",
                        reviewNote: "需要补充引用"
                      })
                    }
                  >
                    驳回
                  </Button>
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    disabled={block.status !== "published"}
                    onClick={() =>
                      void mutate(`/api/internal/knowledge-blocks/${block.blockId}/disable`, {
                        reviewNote: "人工禁用"
                      })
                    }
                  >
                    禁用
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

function statusColor(status: KnowledgeBlockStatus): string {
  if (status === "published") return "green";
  if (status === "pending_review") return "blue";
  if (status === "rejected" || status === "disabled" || status === "expired") return "red";
  return "default";
}
