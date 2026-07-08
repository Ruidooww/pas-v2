import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Descriptions, Form, Input, Spin, Tag, Typography } from "antd";
import { api } from "../api";
import type { LoginBranding, SystemOverview, SystemSettingItem, UpdateLoginBrandingRequest } from "../types";

const GROUP_TITLES: Record<SystemSettingItem["group"], string> = {
  branding: "品牌",
  ragflow: "RAGFlow",
  llm: "LLM",
  storage: "存储",
  database: "数据库",
  export: "导出"
};

export function SystemSettingsPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<UpdateLoginBrandingRequest>();

  useEffect(() => {
    void refreshOverview();
  }, []);

  useEffect(() => {
    if (overview?.branding) {
      form.setFieldsValue(brandingFormValues(overview.branding));
    }
  }, [form, overview?.branding]);

  const groupedSettings = useMemo(() => {
    const groups = new Map<SystemSettingItem["group"], SystemSettingItem[]>();
    for (const item of overview?.settings ?? []) {
      groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [overview]);
  const settings = overview?.settings ?? [];
  const configuredSettings = settings.filter((item) => item.status === "configured" || item.status === "enabled").length;
  const missingSettings = settings.filter((item) => item.status === "missing" || item.status === "disabled").length;

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">CONFIG</Typography.Text>
          <Typography.Title level={3}>系统设置</Typography.Title>
          <Typography.Text type="secondary">集中查看外部服务、存储、数据库和导出链路配置状态。</Typography.Text>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">配置项</Typography.Text>
          <strong>{settings.length}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">已配置</Typography.Text>
          <strong>{configuredSettings}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">待处理</Typography.Text>
          <strong>{missingSettings}</strong>
        </div>
      </section>

      <Card className="pas-panel" title="系统设置">
        {loading ? (
          <div className="system-loading">
            <Spin />
          </div>
        ) : (
          <div className="system-settings-grid">
            {groupedSettings.map(([group, items]) => (
              <Card className="system-subpanel" key={group} title={GROUP_TITLES[group]}>
                <Descriptions size="small" column={1}>
                  {items.map((item) => (
                    <Descriptions.Item
                      key={item.key}
                      label={
                        <span className="system-setting-label">
                          {item.label}
                          <Tag color={statusColor(item.status)}>{item.status}</Tag>
                        </span>
                      }
                    >
                      <Typography.Text>{item.value}</Typography.Text>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="pas-panel" title="登录页品牌">
        <div className="system-branding-layout">
          <Form
            className="system-branding-form"
            form={form}
            layout="vertical"
            onFinish={(values) => void saveBranding(values)}
          >
            <Form.Item name="title" label="登录页标题" rules={[{ required: true, message: "请输入登录页标题" }]}>
              <Input maxLength={80} />
            </Form.Item>
            <Form.Item name="subtitle" label="登录页说明" rules={[{ required: true, message: "请输入登录页说明" }]}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item
              name="logoUrl"
              label="Logo URL"
              rules={[{ pattern: /^(\/|https?:\/\/|$)/i, message: "请输入 / 开头路径或 http(s) URL" }]}
            >
              <Input placeholder="/assets/logo.png 或 https://example.com/logo.png" maxLength={500} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={savingBranding}>
              保存登录页品牌
            </Button>
          </Form>
          <div className="system-branding-preview">
            <Typography.Text type="secondary">预览</Typography.Text>
            <div className="system-branding-logo">
              {overview?.branding.logoUrl ? <img src={overview.branding.logoUrl} alt="登录页 logo 预览" /> : <span>P</span>}
            </div>
            <Typography.Title level={4}>{overview?.branding.title ?? "PAS 售前辅助系统"}</Typography.Title>
            <Typography.Paragraph type="secondary">
              {overview?.branding.subtitle ?? "账号由管理员分配，如无账号请联系管理员"}
            </Typography.Paragraph>
          </div>
        </div>
      </Card>
    </div>
  );

  async function refreshOverview(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setOverview(await api<SystemOverview>("/api/internal/system/overview"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "系统设置加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function saveBranding(values: UpdateLoginBrandingRequest): Promise<void> {
    setSavingBranding(true);
    setError(null);
    try {
      const branding = await api<LoginBranding>("/api/internal/system/branding", {
        method: "PATCH",
        body: values
      });
      setOverview((current) => current ? { ...current, branding, settings: updateBrandingSetting(current.settings, branding) } : current);
      form.setFieldsValue(brandingFormValues(branding));
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录页品牌保存失败");
    } finally {
      setSavingBranding(false);
    }
  }
}

function brandingFormValues(branding: LoginBranding): UpdateLoginBrandingRequest {
  return {
    title: branding.title,
    subtitle: branding.subtitle,
    logoUrl: branding.logoUrl ?? ""
  };
}

function updateBrandingSetting(settings: SystemSettingItem[], branding: LoginBranding): SystemSettingItem[] {
  return settings.map((item) =>
    item.key === "LOGIN_BRANDING"
      ? {
          ...item,
          value: branding.logoUrl ? "custom logo" : "default logo",
          status: branding.logoUrl ? "configured" : "default"
        }
      : item
  );
}

function statusColor(status: SystemSettingItem["status"]): string {
  switch (status) {
    case "enabled":
    case "configured":
      return "green";
    case "missing":
    case "disabled":
      return "red";
    default:
      return "default";
  }
}
