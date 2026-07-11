import { useEffect, useRef, useState } from "react";
import {
  ApiOutlined,
  ExperimentOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SaveOutlined
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Spin,
  Tabs,
  Tag,
  Typography
} from "antd";
import { api, ApiError } from "../api";
import type {
  AiModelCandidateRequest,
  AiModelErrorCode,
  AiModelOverview,
  AiModelProvider,
  AiModelTestResult,
  RagflowModelOverview
} from "../types";

type GenerationFormValues = AiModelCandidateRequest & {
  apiKey?: string;
};

export function AiModelAccessPage() {
  const [overview, setOverview] = useState<AiModelOverview | null>(null);
  const [ragflow, setRagflow] = useState<RagflowModelOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [refreshingRagflow, setRefreshingRagflow] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<string | null>(null);
  const [ragflowError, setRagflowError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AiModelTestResult | null>(null);
  const [form] = Form.useForm<GenerationFormValues>();
  const overviewRequestId = useRef(0);
  const ragflowRequestId = useRef(0);

  useEffect(() => {
    void refreshOverview();
    void refreshRagflow();
  }, []);

  const generation = overview?.generation;
  const saved = overview?.savedConfiguration;

  return (
    <div className="ai-model-page">
      {overviewError && <Alert type="error" showIcon title={overviewError} />}
      <section className="ai-model-header">
        <div className="ai-model-header-copy">
          <span className="ai-model-header-icon" aria-hidden="true">
            <ApiOutlined />
          </span>
          <div>
            <Typography.Text className="system-eyebrow">MODEL</Typography.Text>
            <Typography.Title level={3}>AI 模型接入</Typography.Title>
          </div>
        </div>
        <div className="ai-model-status-block">
          <Typography.Text type="secondary">有效状态</Typography.Text>
          <Tag color={statusColor(generation?.status)}>{statusLabel(generation?.status)}</Tag>
        </div>
        <div className="ai-model-status-block">
          <Typography.Text type="secondary">配置来源</Typography.Text>
          <strong>{generation?.source ?? "-"}</strong>
        </div>
        <div className="ai-model-status-block ai-model-status-model">
          <Typography.Text type="secondary">当前模型</Typography.Text>
          <strong>{generation?.model ?? "未配置"}</strong>
        </div>
      </section>

      <section className="ai-model-workspace">
        <Tabs
          items={[
            {
              key: "generation",
              label: "PAS 生成模型",
              children: (
                <div className="ai-model-tab-content">
                  {operationError && (
                    <Alert type="error" showIcon title={operationError} closable onClose={() => setOperationError(null)} />
                  )}
                  {operationNotice && (
                    <Alert type="success" showIcon title={operationNotice} closable onClose={() => setOperationNotice(null)} />
                  )}
                  {testResult && !testResult.ok && (
                    <Alert
                      type="error"
                      showIcon
                      title={modelErrorMessage(testResult.errorCode)}
                      description={`候选配置测试失败，当前生效配置未变更 · ${testResult.elapsedMs} ms`}
                    />
                  )}
                  {testResult?.ok && (
                    <Alert type="success" showIcon title="连接测试通过" description={`${testResult.elapsedMs} ms`} />
                  )}

                  <div className="ai-model-effective-meta">
                    <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                      <Descriptions.Item label="API Key">
                        <Tag color={generation?.keyConfigured ? "green" : "default"}>
                          {generation?.keyConfigured ? "已配置" : "未配置"}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="最近保存测试">
                        {generation?.lastTestStatus ?? "无"}
                      </Descriptions.Item>
                      <Descriptions.Item label="测试时间">
                        {formatTimestamp(generation?.lastTestedAt)}
                      </Descriptions.Item>
                      <Descriptions.Item label="更新人">{generation?.updatedBy ?? "-"}</Descriptions.Item>
                      <Descriptions.Item label="更新时间">
                        {formatTimestamp(generation?.updatedAt)}
                      </Descriptions.Item>
                      <Descriptions.Item label="超时">{generation?.timeoutSeconds ?? 30} 秒</Descriptions.Item>
                    </Descriptions>
                  </div>

                  {loadingOverview && !overview ? (
                    <div className="ai-model-loading"><Spin /></div>
                  ) : (
                    <Form
                      form={form}
                      layout="vertical"
                      requiredMark={false}
                      onFinish={(values) => void saveGeneration(values)}
                    >
                      <div className="ai-model-form-grid">
                        <Form.Item name="provider" label="服务商" rules={[{ required: true, message: "请选择服务商" }]}>
                          <Select
                            virtual={false}
                            options={(overview?.providers ?? []).map((preset) => ({
                              value: preset.provider,
                              label: preset.label
                            }))}
                            onChange={(provider: AiModelProvider) => applyProviderPreset(provider)}
                          />
                        </Form.Item>
                        <Form.Item
                          name="model"
                          label="模型 ID"
                          rules={[{ required: true, whitespace: true, message: "请输入模型 ID" }]}
                        >
                          <Input maxLength={200} autoComplete="off" />
                        </Form.Item>
                        <Form.Item
                          className="ai-model-form-wide"
                          name="baseUrl"
                          label="Base URL"
                          rules={[
                            { required: true, whitespace: true, message: "请输入 Base URL" },
                            { type: "url", message: "请输入有效 URL" }
                          ]}
                        >
                          <Input maxLength={500} autoComplete="off" />
                        </Form.Item>
                        <Form.Item name="apiKey" label="API Key">
                          <Input.Password
                            autoComplete="new-password"
                            placeholder={saved?.keyConfigured ? "留空保留现有 Key" : "输入 API Key"}
                          />
                        </Form.Item>
                        <Form.Item
                          name="timeoutSeconds"
                          label="超时时间（秒）"
                          rules={[
                            { required: true, message: "请输入超时时间" },
                            { type: "number", min: 5, max: 120, message: "超时时间需为 5-120 秒" }
                          ]}
                        >
                          <InputNumber min={5} max={120} step={5} />
                        </Form.Item>
                      </div>

                      <div className="ai-model-actions">
                        <Button
                          icon={<ExperimentOutlined />}
                          loading={testing}
                          onClick={() => void testGeneration()}
                        >
                          测试连接
                        </Button>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                          保存并启用
                        </Button>
                        <Popconfirm
                          title="停用数据库配置？"
                          description="停用后将使用环境配置或确定性回退。"
                          okText="停用"
                          cancelText="取消"
                          onConfirm={() => void disableGeneration()}
                        >
                          <Button
                            danger
                            icon={<PoweroffOutlined />}
                            loading={disabling}
                            disabled={!saved?.enabled}
                          >
                            停用数据库配置
                          </Button>
                        </Popconfirm>
                      </div>
                    </Form>
                  )}
                </div>
              )
            },
            {
              key: "ragflow",
              label: "RAGFlow 模型状态",
              children: (
                <div className="ai-model-tab-content" role="region" aria-label="RAGFlow 模型状态">
                  <div className="ai-model-section-heading">
                    <div>
                      <Typography.Title level={4}>RAGFlow</Typography.Title>
                      <Tag color={ragflowStatusColor(ragflow?.status)}>{ragflowStatusLabel(ragflow?.status)}</Tag>
                    </div>
                    <Button
                      aria-label="刷新 RAGFlow 状态"
                      icon={<ReloadOutlined />}
                      loading={refreshingRagflow}
                      onClick={() => void refreshRagflow()}
                    />
                  </div>
                  {ragflowError && <Alert type="error" showIcon title={ragflowError} />}
                  {ragflow?.status === "error" && (
                    <Alert type="error" showIcon title="RAGFlow 连接异常" description={ragflow.errorKind ?? "unknown"} />
                  )}
                  {refreshingRagflow && !ragflow ? (
                    <div className="ai-model-loading"><Spin /></div>
                  ) : (
                    <Descriptions className="ai-model-ragflow-details" bordered column={{ xs: 1, md: 2 }} size="small">
                      <Descriptions.Item label="Base URL">
                        <span className="ai-model-value">{ragflow?.baseUrl ?? "不可用"}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="数据集">
                        {ragflow?.dataset?.name ?? "不可用"}
                      </Descriptions.Item>
                      <Descriptions.Item label="数据集 ID">
                        <span className="ai-model-value">{ragflow?.dataset?.datasetId ?? "不可用"}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Embedding">
                        <span className="ai-model-value">{ragflow?.dataset?.embeddingModel ?? "不可用"}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Reranker">
                        <span className="ai-model-value">{ragflow?.dataset?.rerankerModel ?? "不可用"}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Chat Model">
                        <span className="ai-model-value">{ragflow?.dataset?.chatModel ?? "不可用"}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="语言">{ragflow?.dataset?.language ?? "不可用"}</Descriptions.Item>
                      <Descriptions.Item label="切块方式">{ragflow?.dataset?.chunkMethod ?? "不可用"}</Descriptions.Item>
                      <Descriptions.Item label="文档数">{displayNumber(ragflow?.dataset?.documentCount)}</Descriptions.Item>
                      <Descriptions.Item label="Chunk 数">{displayNumber(ragflow?.dataset?.chunkCount)}</Descriptions.Item>
                      <Descriptions.Item label="刷新时间">{formatTimestamp(ragflow?.refreshedAt)}</Descriptions.Item>
                    </Descriptions>
                  )}
                </div>
              )
            }
          ]}
        />
      </section>
    </div>
  );

  async function refreshOverview(): Promise<void> {
    const requestId = ++overviewRequestId.current;
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const next = await api<AiModelOverview>("/api/internal/ai-models/overview");
      if (requestId !== overviewRequestId.current) return;
      setOverview(next);
      form.setFieldsValue(formValues(next));
    } catch (error) {
      if (requestId === overviewRequestId.current) {
        setOverviewError(errorMessage(error, "模型配置加载失败"));
      }
    } finally {
      if (requestId === overviewRequestId.current) {
        setLoadingOverview(false);
      }
    }
  }

  async function refreshRagflow(): Promise<void> {
    const requestId = ++ragflowRequestId.current;
    setRefreshingRagflow(true);
    setRagflowError(null);
    try {
      const next = await api<RagflowModelOverview>("/api/internal/ai-models/ragflow");
      if (requestId === ragflowRequestId.current) {
        setRagflow(next);
      }
    } catch (error) {
      if (requestId === ragflowRequestId.current) {
        setRagflowError(errorMessage(error, "RAGFlow 状态刷新失败"));
      }
    } finally {
      if (requestId === ragflowRequestId.current) {
        setRefreshingRagflow(false);
      }
    }
  }

  function applyProviderPreset(provider: AiModelProvider): void {
    const preset = overview?.providers.find((item) => item.provider === provider);
    form.setFieldsValue({ provider, baseUrl: preset?.defaultBaseUrl ?? "" });
  }

  async function testGeneration(): Promise<void> {
    setOperationError(null);
    setOperationNotice(null);
    try {
      const values = await form.validateFields();
      setTesting(true);
      const result = await api<AiModelTestResult>("/api/internal/ai-models/generation/test", {
        method: "POST",
        body: candidatePayload(values)
      });
      setTestResult(result);
    } catch (error) {
      if (error instanceof ApiError) {
        setOperationError(errorMessage(error, "连接测试失败"));
      }
    } finally {
      setTesting(false);
    }
  }

  async function saveGeneration(values: GenerationFormValues): Promise<void> {
    setSaving(true);
    setOperationError(null);
    setOperationNotice(null);
    try {
      const next = await api<AiModelOverview>("/api/internal/ai-models/generation", {
        method: "PUT",
        body: candidatePayload(values)
      });
      overviewRequestId.current += 1;
      setOverview(next);
      form.setFieldsValue(formValues(next));
      setTestResult(null);
      setOperationNotice("配置已保存并启用");
    } catch (error) {
      setOperationError(errorMessage(error, "模型配置保存失败"));
    } finally {
      setSaving(false);
    }
  }

  async function disableGeneration(): Promise<void> {
    setDisabling(true);
    setOperationError(null);
    setOperationNotice(null);
    try {
      const next = await api<AiModelOverview>("/api/internal/ai-models/generation", { method: "DELETE" });
      overviewRequestId.current += 1;
      setOverview(next);
      form.setFieldsValue(formValues(next));
      setTestResult(null);
      setOperationNotice("数据库配置已停用");
    } catch (error) {
      setOperationError(errorMessage(error, "数据库配置停用失败"));
    } finally {
      setDisabling(false);
    }
  }
}

function formValues(overview: AiModelOverview): GenerationFormValues {
  const editable = overview.savedConfiguration ?? overview.generation;
  const provider = editable.provider ?? overview.providers[0]?.provider ?? "bailian";
  const preset = overview.providers.find((item) => item.provider === provider);
  return {
    provider,
    baseUrl: editable.baseUrl ?? preset?.defaultBaseUrl ?? "",
    model: editable.model ?? "",
    apiKey: "",
    timeoutSeconds: editable.timeoutSeconds ?? 30
  };
}

function candidatePayload(values: GenerationFormValues): AiModelCandidateRequest {
  const apiKey = values.apiKey?.trim();
  return {
    provider: values.provider,
    baseUrl: values.baseUrl.trim(),
    model: values.model.trim(),
    timeoutSeconds: values.timeoutSeconds,
    ...(apiKey ? { apiKey } : {})
  };
}

function statusLabel(status: AiModelOverview["generation"]["status"] | undefined): string {
  if (status === "running") return "运行中";
  if (status === "error") return "连接异常";
  return "未配置";
}

function statusColor(status: AiModelOverview["generation"]["status"] | undefined): string {
  if (status === "running") return "green";
  if (status === "error") return "red";
  return "default";
}

function ragflowStatusLabel(status: RagflowModelOverview["status"] | undefined): string {
  if (status === "ok") return "正常";
  if (status === "error") return "异常";
  if (status === "disabled") return "已停用";
  return "加载中";
}

function ragflowStatusColor(status: RagflowModelOverview["status"] | undefined): string {
  if (status === "ok") return "green";
  if (status === "error") return "red";
  return "default";
}

function modelErrorMessage(code: AiModelErrorCode | undefined, fallback = "连接测试失败"): string {
  const messages: Record<AiModelErrorCode, string> = {
    MODEL_CONFIG_ENCRYPTION_UNAVAILABLE: "数据库模型密钥无法解密",
    MODEL_CONFIGURATION_INVALID: "模型配置无效",
    MODEL_API_KEY_REQUIRED: "请输入 API Key",
    MODEL_ENDPOINT_NOT_ALLOWED: "模型地址不在允许范围内",
    MODEL_PERSISTENCE_UNAVAILABLE: "模型配置暂时无法保存",
    MODEL_AUTHENTICATION_FAILED: "API Key 无效或无权限",
    MODEL_ENDPOINT_OR_MODEL_NOT_FOUND: "模型地址或模型 ID 不存在",
    MODEL_RATE_LIMITED: "模型服务请求过于频繁",
    MODEL_PROVIDER_UNAVAILABLE: "模型服务暂不可用",
    MODEL_REQUEST_TIMEOUT: "模型请求超时",
    MODEL_RESPONSE_INVALID: "模型返回内容无效"
  };
  return (code && messages[code]) || fallback;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.code) {
    return modelErrorMessage(error.code as AiModelErrorCode, error.message || fallback);
  }
  return error instanceof Error ? error.message : fallback;
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function displayNumber(value: number | undefined): number | string {
  return value ?? "不可用";
}
