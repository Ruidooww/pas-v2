import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, InputNumber, Select, Space, Spin, Switch, Tag, Typography } from "antd";
import { api } from "../api";
import type {
  MenuConfiguration,
  PrimaryMenuDefinition,
  PrimaryMenuKey,
  PublicUser,
  SecondaryMenuDefinition,
  SecondaryMenuKey,
  SecondaryMenuOverride,
  UpdateSecondaryMenuOverrideRequest
} from "../types";

type Role = PublicUser["role"];

type MenuConfigRow = SecondaryMenuDefinition & {
  alias: string;
  visible: boolean;
  roles: Role[];
  isDefault: boolean;
};

const ROLE_OPTIONS: Array<{ label: string; value: Role }> = [
  { label: "sales", value: "sales" },
  { label: "presales", value: "presales" },
  { label: "admin", value: "admin" }
];

export function MenuConfigPage() {
  const [config, setConfig] = useState<MenuConfiguration | null>(null);
  const [selectedPrimaryKey, setSelectedPrimaryKey] = useState<PrimaryMenuKey>("customers");
  const [drafts, setDrafts] = useState<Record<string, Partial<MenuConfigRow>>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshConfig();
  }, []);

  const selectedPrimary = useMemo(
    () => config?.defaults.find((item) => item.key === selectedPrimaryKey) ?? config?.defaults[0],
    [config, selectedPrimaryKey]
  );

  const rows = useMemo(() => {
    if (!config || !selectedPrimary) return [];
    return selectedPrimary.children.map((child) => toRow(child, findOverride(config.overrides, selectedPrimary.key, child.key), drafts));
  }, [config, drafts, selectedPrimary]);
  const visibleRows = rows.filter((row) => row.visible).length;
  const customRows =
    config && selectedPrimary
      ? config.overrides.filter((override) => override.primaryKey === selectedPrimary.key).length
      : 0;

  if (loading) {
    return (
      <div className="pas-boot">
        <Spin />
      </div>
    );
  }

  return (
    <div className="menu-config-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">MENU</Typography.Text>
          <Typography.Title level={3}>菜单配置</Typography.Title>
          <Typography.Text type="secondary">一级菜单固定，二级菜单支持展示名称、角色、排序和默认入口调整。</Typography.Text>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">一级菜单</Typography.Text>
          <strong>{config?.defaults.length ?? 0}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">本组可见</Typography.Text>
          <strong>{visibleRows}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">本组改动</Typography.Text>
          <strong>{customRows}</strong>
        </div>
      </section>

      <div className="menu-config-layout">
        <Card className="pas-panel menu-config-primary" title="固定一级菜单">
          <div className="menu-config-primary-list">
            {(config?.defaults ?? []).map((primary) => (
              <Button
                block
                key={primary.key}
                type={primary.key === selectedPrimary?.key ? "primary" : "text"}
                onClick={() => setSelectedPrimaryKey(primary.key)}
              >
                {primary.label}
              </Button>
            ))}
          </div>
        </Card>

        <Card
          className="pas-panel menu-config-table"
          title={selectedPrimary?.label ?? "二级菜单配置"}
          extra={
            <Button onClick={() => selectedPrimary && void resetPrimary(selectedPrimary)}>
              恢复本组默认
            </Button>
          }
        >
          <div className="menu-config-secondary-list">
            {rows.map((row) => (
              <div className="menu-config-secondary-item" key={row.key}>
                <div className="menu-config-secondary-main">
                  <Space orientation="vertical" size={2}>
                    <Typography.Text strong>{row.alias || row.label}</Typography.Text>
                    <Typography.Text type="secondary">{row.route}</Typography.Text>
                  </Space>
                  <Switch
                    aria-label={row.label}
                    checked={row.visible}
                    loading={savingKey === row.key}
                    onChange={(visible) => void saveRow(row, { visible })}
                  />
                </div>
                <div className="menu-config-secondary-controls">
                  <Input
                    aria-label={`${row.label}别名`}
                    value={row.alias}
                    placeholder={row.label}
                    onChange={(event) => updateDraft(row.key, { alias: event.target.value })}
                  />
                  <Select
                    aria-label={`${row.label}角色`}
                    mode="multiple"
                    options={ROLE_OPTIONS}
                    value={row.roles}
                    onChange={(roles) => updateDraft(row.key, { roles })}
                  />
                  <InputNumber
                    aria-label={`${row.label}排序`}
                    min={1}
                    step={10}
                    value={row.order}
                    onChange={(order) => updateDraft(row.key, { order: Number(order || row.order) })}
                  />
                  {row.isDefault ? (
                    <Tag color="blue">默认入口</Tag>
                  ) : (
                    <Button onClick={() => void saveRow(row, { isDefault: true })}>设为默认</Button>
                  )}
                  <Button type="primary" loading={savingKey === row.key} onClick={() => void saveRow(row, {})}>
                    保存
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="pas-panel menu-config-rail" title="配置边界">
          <Space orientation="vertical" size={12}>
            <Typography.Paragraph>
              一级菜单由系统固定，配置只影响当前一级菜单下的二级菜单。
            </Typography.Paragraph>
            <Typography.Paragraph>
              可调整显示状态、展示名称、角色可见性、排序和默认入口。
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              后端会校验管理员权限，普通销售和售前只能读取自己的有效菜单。
            </Typography.Paragraph>
          </Space>
        </Card>
      </div>
    </div>
  );

  async function refreshConfig(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const nextConfig = await api<MenuConfiguration>("/api/internal/menu/configuration");
      setConfig(nextConfig);
      if (!nextConfig.defaults.some((item) => item.key === selectedPrimaryKey)) {
        setSelectedPrimaryKey(nextConfig.defaults[0]?.key ?? "customers");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "菜单配置加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(row: MenuConfigRow, patch: Partial<MenuConfigRow>): Promise<void> {
    if (!selectedPrimary) return;
    const alias = (patch.alias ?? row.alias).trim();
    const payload: UpdateSecondaryMenuOverrideRequest = {
      primaryKey: selectedPrimary.key,
      secondaryKey: row.key,
      visible: patch.visible ?? row.visible,
      order: patch.order ?? row.order,
      alias: alias || undefined,
      roles: patch.roles ?? row.roles,
      isDefault: patch.isDefault ?? row.isDefault
    };

    setSavingKey(row.key);
    setError(null);
    try {
      const nextConfig = await api<MenuConfiguration>("/api/internal/menu/configuration", {
        method: "PATCH",
        body: payload
      });
      setConfig(nextConfig);
      clearDraft(row.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "菜单配置保存失败");
    } finally {
      setSavingKey(null);
    }
  }

  async function resetPrimary(primary: PrimaryMenuDefinition): Promise<void> {
    setSavingKey(primary.key);
    setError(null);
    try {
      const nextConfig = await api<MenuConfiguration>(`/api/internal/menu/configuration/${primary.key}/reset`, {
        method: "POST"
      });
      setConfig(nextConfig);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "菜单配置重置失败");
    } finally {
      setSavingKey(null);
    }
  }

  function updateDraft(key: SecondaryMenuKey, patch: Partial<MenuConfigRow>): void {
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch
      }
    }));
  }

  function clearDraft(key: SecondaryMenuKey): void {
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
}

function toRow(
  child: SecondaryMenuDefinition,
  override: SecondaryMenuOverride | undefined,
  drafts: Record<string, Partial<MenuConfigRow>>
): MenuConfigRow {
  const draft = drafts[child.key] ?? {};
  return {
    ...child,
    alias: draft.alias ?? override?.alias ?? "",
    visible: draft.visible ?? override?.visible ?? true,
    roles: draft.roles ?? override?.roles ?? child.roles,
    order: draft.order ?? override?.order ?? child.order,
    isDefault: draft.isDefault ?? override?.isDefault ?? false
  };
}

function findOverride(
  overrides: SecondaryMenuOverride[],
  primaryKey: PrimaryMenuKey,
  secondaryKey: SecondaryMenuKey
): SecondaryMenuOverride | undefined {
  return overrides.find((override) => override.primaryKey === primaryKey && override.secondaryKey === secondaryKey);
}
