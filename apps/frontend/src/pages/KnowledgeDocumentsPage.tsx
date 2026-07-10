import { EditOutlined, ReloadOutlined, StopOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Select, Space, Tag, Tooltip, Typography } from "antd";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import type {
  KnowledgeDocument,
  KnowledgeDocumentMaterialType,
  KnowledgeDocumentParseStatus,
  KnowledgeDocumentVisibility,
  OrganizationUnit,
  ProjectGroup,
  PublicUser,
  UserRole
} from "../types";

type VisibilityScope = KnowledgeDocumentVisibility["scope"];

type DocumentFormState = {
  documentId: string;
  title: string;
  product: string;
  materialType: KnowledgeDocumentMaterialType;
  sourceName: string;
  tags: string;
  parseStatus: KnowledgeDocumentParseStatus;
  chunkCount: number;
  hitCount: number;
  badFeedbackCount: number;
  failureReason?: string;
  visibilityScope: VisibilityScope;
  visibilityTargetIds: string[];
};

type SelectOption = { label: string; value: string };

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

const visibilityScopeOptions: Array<{ label: string; value: VisibilityScope }> = [
  { label: "全员可见", value: "public" },
  { label: "角色", value: "roles" },
  { label: "指定用户", value: "users" },
  { label: "组织单元", value: "organization_units" },
  { label: "项目组", value: "project_groups" }
];

const roleOptions: SelectOption[] = [
  { label: "sales", value: "sales" },
  { label: "technical", value: "technical" },
  { label: "admin", value: "admin" }
];

export function KnowledgeDocumentsPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [organizationUnits, setOrganizationUnits] = useState<OrganizationUnit[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [parseStatus, setParseStatus] = useState<KnowledgeDocumentParseStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<DocumentFormState>(createEmptyForm);

  const listPath = useMemo(() => {
    if (parseStatus === "all") return "/api/internal/knowledge-documents";
    return `/api/internal/knowledge-documents?parseStatus=${encodeURIComponent(parseStatus)}`;
  }, [parseStatus]);

  const visibilityTargetOptions = useMemo(
    () => targetOptionsForScope(form.visibilityScope, users, organizationUnits, projectGroups),
    [form.visibilityScope, organizationUnits, projectGroups, users]
  );
  const validTargetIds = new Set(visibilityTargetOptions.map((option) => option.value));
  const hasValidVisibility =
    form.visibilityScope === "public" ||
    (form.visibilityTargetIds.length > 0 && form.visibilityTargetIds.every((targetId) => validTargetIds.has(targetId)));
  const canSave =
    Boolean(form.documentId.trim() && form.title.trim() && form.product.trim() && form.sourceName.trim()) &&
    hasValidVisibility;

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

  useEffect(() => {
    void loadVisibilityCatalogs();
  }, []);

  const saveDocument = async () => {
    if (!canSave) return;
    const wasEditing = editingDocumentId !== null;
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
          parseStatus: form.parseStatus,
          chunkCount: form.chunkCount,
          hitCount: form.hitCount,
          badFeedbackCount: form.badFeedbackCount,
          tags: splitTags(form.tags),
          visibility: createVisibility(form.visibilityScope, form.visibilityTargetIds),
          ...(form.failureReason ? { failureReason: form.failureReason } : {})
        }
      });
      setForm(createEmptyForm());
      setEditingDocumentId(null);
      setNotice({ type: "success", text: wasEditing ? "文档元数据已保存" : "文档元数据已登记" });
      await loadDocuments();
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "保存失败" });
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
        <div className="knowledge-filter-row">
          <Select
            aria-label="解析状态"
            virtual={false}
            value={parseStatus}
            onChange={setParseStatus}
            options={parseStatusOptions}
          />
        </div>
        <div className="knowledge-form-grid">
          <Input
            aria-label="文档 ID"
            value={form.documentId}
            disabled={editingDocumentId !== null}
            onChange={(event) => setFormField("documentId", event.target.value)}
            placeholder="RAGFlow document id"
          />
          <Input
            aria-label="文档标题"
            value={form.title}
            onChange={(event) => setFormField("title", event.target.value)}
            placeholder="文档标题"
          />
          <Input
            aria-label="产品"
            value={form.product}
            onChange={(event) => setFormField("product", event.target.value)}
            placeholder="产品"
          />
          <Select
            aria-label="资料类型"
            virtual={false}
            value={form.materialType}
            onChange={(value) => setFormField("materialType", value)}
            options={materialTypeOptions}
          />
          <Input
            aria-label="源文件名"
            value={form.sourceName}
            onChange={(event) => setFormField("sourceName", event.target.value)}
            placeholder="源文件名"
          />
          <Input
            aria-label="标签"
            value={form.tags}
            onChange={(event) => setFormField("tags", event.target.value)}
            placeholder="标签，用空格或逗号分隔"
          />
        </div>
        <div className="knowledge-visibility-row">
          <Select
            aria-label="可见范围"
            virtual={false}
            value={form.visibilityScope}
            onChange={changeVisibilityScope}
            options={visibilityScopeOptions}
          />
          {form.visibilityScope !== "public" && (
            <Select
              aria-label="可见目标"
              mode="multiple"
              virtual={false}
              value={form.visibilityTargetIds}
              onChange={(visibilityTargetIds) => setFormField("visibilityTargetIds", visibilityTargetIds)}
              options={visibilityTargetOptions}
              placeholder="选择可见目标"
            />
          )}
          <div className="knowledge-form-actions">
            {editingDocumentId && <Button onClick={cancelEditing}>取消编辑</Button>}
            <Button type="primary" loading={saving} disabled={!canSave} onClick={() => void saveDocument()}>
              {editingDocumentId ? "保存文档" : "登记文档"}
            </Button>
          </div>
        </div>
      </Card>

      {notice && <Alert type={notice.type} title={notice.text} closable onClose={() => setNotice(null)} />}

      <Card className="pas-panel" title="文档列表" loading={loading}>
        {documents.length === 0 ? (
          <EmptyState title="暂无文档元数据" description="当前仅登记 PAS 侧索引；真实资料仍在 RAGFlow 控制台维护。" />
        ) : (
          <div className="knowledge-list">
            {documents.map((document) => {
              const visibilityTargets = visibilityTargetNames(document.visibility, users, organizationUnits, projectGroups);
              return (
                <div className="knowledge-list-item" key={document.documentId}>
                  <div className="knowledge-list-content">
                    <Space wrap>
                      <Typography.Text strong>{document.title}</Typography.Text>
                      <Tag color={parseStatusColor(document.parseStatus)}>{document.parseStatus}</Tag>
                      <Tag color={document.enabled ? "green" : "red"}>
                        {document.enabled ? "enabled" : "disabled"}
                      </Tag>
                      <Tag>{visibilityScopeLabel(document.visibility.scope)}</Tag>
                      {visibilityTargets.length > 0 && (
                        <Typography.Text className="knowledge-visibility-targets" type="secondary">
                          {visibilityTargets.join("、")}
                        </Typography.Text>
                      )}
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
                    <Tooltip title="编辑">
                      <Button
                        aria-label={`编辑 ${document.title}`}
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => editDocument(document)}
                      />
                    </Tooltip>
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
              );
            })}
          </div>
        )}
      </Card>
    </Space>
  );

  async function loadVisibilityCatalogs(): Promise<void> {
    const [userResult, unitResult, groupResult] = await Promise.allSettled([
      api<PublicUser[]>("/api/internal/auth/users"),
      api<OrganizationUnit[]>("/api/internal/organization/units"),
      api<ProjectGroup[]>("/api/internal/organization/project-groups")
    ]);
    if (userResult.status === "fulfilled" && Array.isArray(userResult.value)) setUsers(userResult.value);
    if (unitResult.status === "fulfilled" && Array.isArray(unitResult.value)) setOrganizationUnits(unitResult.value);
    if (groupResult.status === "fulfilled" && Array.isArray(groupResult.value)) setProjectGroups(groupResult.value);

    const requiredFailure = [unitResult, groupResult].find((result) => result.status === "rejected");
    if (requiredFailure?.status === "rejected") {
      setNotice({
        type: "error",
        text: requiredFailure.reason instanceof Error ? requiredFailure.reason.message : "可见范围数据加载失败"
      });
    }
  }

  function setFormField<Key extends keyof DocumentFormState>(key: Key, value: DocumentFormState[Key]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeVisibilityScope(visibilityScope: VisibilityScope): void {
    setForm((current) => ({
      ...current,
      visibilityScope,
      visibilityTargetIds: visibilityScope === "organization_units" ? ["org-technical"] : []
    }));
  }

  function editDocument(document: KnowledgeDocument): void {
    setEditingDocumentId(document.documentId);
    setForm({
      documentId: document.documentId,
      title: document.title,
      product: document.product,
      materialType: document.materialType,
      sourceName: document.sourceName,
      tags: document.tags.join(", "),
      parseStatus: document.parseStatus,
      chunkCount: document.chunkCount,
      hitCount: document.hitCount,
      badFeedbackCount: document.badFeedbackCount,
      failureReason: document.failureReason,
      visibilityScope: document.visibility.scope,
      visibilityTargetIds: visibilityTargetIds(document.visibility)
    });
    setNotice(null);
  }

  function cancelEditing(): void {
    setEditingDocumentId(null);
    setForm(createEmptyForm());
  }
}

function createEmptyForm(): DocumentFormState {
  return {
    documentId: "",
    title: "",
    product: "IP-Guard",
    materialType: "pdf",
    sourceName: "",
    tags: "",
    parseStatus: "pending",
    chunkCount: 0,
    hitCount: 0,
    badFeedbackCount: 0,
    visibilityScope: "organization_units",
    visibilityTargetIds: ["org-technical"]
  };
}

function targetOptionsForScope(
  scope: VisibilityScope,
  users: PublicUser[],
  organizationUnits: OrganizationUnit[],
  projectGroups: ProjectGroup[]
): SelectOption[] {
  if (scope === "roles") return roleOptions;
  if (scope === "users") {
    return users
      .filter((user) => user.active)
      .map((user) => ({ label: user.displayName || user.username, value: user.userId }));
  }
  if (scope === "organization_units") {
    return organizationUnits.filter((unit) => unit.active).map((unit) => ({ label: unit.name, value: unit.unitId }));
  }
  if (scope === "project_groups") {
    return projectGroups
      .filter((group) => group.active)
      .map((group) => ({ label: group.name, value: group.projectGroupId }));
  }
  return [];
}

function createVisibility(scope: VisibilityScope, targetIds: string[]): KnowledgeDocumentVisibility {
  if (scope === "roles") return { scope, roles: targetIds as UserRole[] };
  if (scope === "users") return { scope, userIds: targetIds };
  if (scope === "organization_units") return { scope, organizationUnitIds: targetIds };
  if (scope === "project_groups") return { scope, projectGroupIds: targetIds };
  return { scope: "public" };
}

function visibilityTargetIds(visibility: KnowledgeDocumentVisibility): string[] {
  if (visibility.scope === "roles") return [...visibility.roles];
  if (visibility.scope === "users") return [...visibility.userIds];
  if (visibility.scope === "organization_units") return [...visibility.organizationUnitIds];
  if (visibility.scope === "project_groups") return [...visibility.projectGroupIds];
  return [];
}

function visibilityTargetNames(
  visibility: KnowledgeDocumentVisibility,
  users: PublicUser[],
  organizationUnits: OrganizationUnit[],
  projectGroups: ProjectGroup[]
): string[] {
  const targetIds = visibilityTargetIds(visibility);
  if (visibility.scope === "users") {
    return targetIds.map((targetId) => {
      const user = users.find((item) => item.userId === targetId);
      return user?.displayName || user?.username || targetId;
    });
  }
  if (visibility.scope === "organization_units") {
    return targetIds.map(
      (targetId) => organizationUnits.find((unit) => unit.unitId === targetId)?.name ?? targetId
    );
  }
  if (visibility.scope === "project_groups") {
    return targetIds.map(
      (targetId) => projectGroups.find((group) => group.projectGroupId === targetId)?.name ?? targetId
    );
  }
  return targetIds;
}

function visibilityScopeLabel(scope: VisibilityScope): string {
  return visibilityScopeOptions.find((option) => option.value === scope)?.label ?? scope;
}

function splitTags(tags: string): string[] {
  return tags
    .split(/[,\s，]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseStatusColor(status: KnowledgeDocumentParseStatus): string {
  if (status === "done") return "green";
  if (status === "parsing" || status === "pending") return "blue";
  return "red";
}
