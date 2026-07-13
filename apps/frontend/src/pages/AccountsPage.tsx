import { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Select, Space, Spin, Switch, Tag, Typography } from "antd";
import { api } from "../api";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { useDrilldownQuery } from "../drilldown";
import type {
  OrganizationCatalog,
  OrganizationUnit,
  PublicUser,
  UpdateUserRequest,
  UserRole
} from "../types";
import { OrganizationAccessPanel } from "./OrganizationAccessPanel";

const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: "sales", value: "sales" },
  { label: "technical", value: "technical" },
  { label: "admin", value: "admin" }
];

const DEFAULT_UNIT_BY_ROLE: Record<UserRole, string> = {
  sales: "org-sales",
  technical: "org-technical-presales",
  admin: "org-company"
};

type CreateUserDraft = {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  organizationUnitId: string;
  projectGroupIds: string[];
};

const EMPTY_CATALOG: OrganizationCatalog = { units: [], projectGroups: [] };
const accountDrilldownSchema = { accounts: ["all", "active", "admin"] } as const;

export function AccountsPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [catalog, setCatalog] = useState<OrganizationCatalog>(EMPTY_CATALOG);
  const [draft, setDraft] = useState<CreateUserDraft>(createEmptyDraft());
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, updateDrilldown] = useDrilldownQuery(accountDrilldownSchema);

  useEffect(() => {
    void refreshUsers();
  }, []);

  const activeUsers = users.filter((user) => user.active).length;
  const adminUsers = users.filter((user) => user.role === "admin").length;
  const visibleUsers = filterUsers(users, drilldown.accounts);
  const activeFilter = accountFilterLabel(drilldown.accounts);
  const projectGroupOptions = catalog.projectGroups.map((group) => ({
    label: group.name,
    value: group.projectGroupId,
    disabled: !group.active
  }));
  const draftUnitOptions = unitOptionsForRole(draft.role, catalog.units);
  const canCreate =
    Boolean(draft.username.trim() && draft.password && draft.displayName.trim()) &&
    draftUnitOptions.some((option) => option.value === draft.organizationUnitId);

  return (
    <div className="system-page accounts-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">ACCESS</Typography.Text>
          <Typography.Title level={3}>账号权限</Typography.Title>
          <Typography.Text type="secondary">统一管理账号、角色、组织单元和项目成员关系。</Typography.Text>
        </div>
        <MetricDrilldown className="system-hero-stat" label="账号总数" onClick={() => updateDrilldown({ accounts: "all" })}>
          <Typography.Text type="secondary">账号总数</Typography.Text>
          <strong>{users.length}</strong>
        </MetricDrilldown>
        <MetricDrilldown className="system-hero-stat" label="启用账号" onClick={() => updateDrilldown({ accounts: "active" })}>
          <Typography.Text type="secondary">启用账号</Typography.Text>
          <strong>{activeUsers}</strong>
        </MetricDrilldown>
        <MetricDrilldown className="system-hero-stat" label="管理员" onClick={() => updateDrilldown({ accounts: "admin" })}>
          <Typography.Text type="secondary">管理员</Typography.Text>
          <strong>{adminUsers}</strong>
        </MetricDrilldown>
      </section>

      {activeFilter && (
        <Space className="drilldown-filter-summary" wrap>
          <Tag color="blue">当前筛选：{activeFilter}</Tag>
          <Button type="link" size="small" onClick={() => updateDrilldown({})}>清除筛选</Button>
        </Space>
      )}

      <Card className="pas-panel" title="创建账号">
        <div className="account-create-grid">
          <Input
            aria-label="账号"
            autoComplete="off"
            name="new-account-username"
            placeholder="账号"
            value={draft.username}
            onChange={(event) => setDraftField("username", event.target.value)}
          />
          <Input
            aria-label="姓名"
            autoComplete="off"
            name="new-account-display-name"
            placeholder="姓名"
            value={draft.displayName}
            onChange={(event) => setDraftField("displayName", event.target.value)}
          />
          <Input.Password
            aria-label="初始密码"
            autoComplete="new-password"
            name="new-account-password"
            placeholder="初始密码"
            value={draft.password}
            onChange={(event) => setDraftField("password", event.target.value)}
          />
          <Select
            aria-label="新账号角色"
            virtual={false}
            options={ROLE_OPTIONS}
            value={draft.role}
            onChange={(role) =>
              setDraft((current) => ({
                ...current,
                role,
                organizationUnitId: preferredUnitIdForRole(role, catalog.units) ?? ""
              }))
            }
          />
          <Select
            aria-label="新账号组织单元"
            virtual={false}
            options={draftUnitOptions}
            value={draft.organizationUnitId}
            onChange={(organizationUnitId) => setDraftField("organizationUnitId", organizationUnitId)}
          />
          <Select
            aria-label="新账号项目组"
            mode="multiple"
            virtual={false}
            options={projectGroupOptions}
            value={draft.projectGroupIds}
            onChange={(projectGroupIds) => setDraftField("projectGroupIds", projectGroupIds)}
          />
          <Button type="primary" loading={creating} disabled={!canCreate} onClick={() => void createUser()}>
            创建账号
          </Button>
        </div>
      </Card>

      <Card className="pas-panel" title="账号列表">
        {loading ? (
          <div className="system-loading"><Spin /></div>
        ) : (
          <div className="system-list account-list">
            {visibleUsers.map((user) => {
              const unit = catalog.units.find((item) => item.unitId === user.organizationUnitId);
              return (
                <div className="system-list-item account-list-item" key={user.userId}>
                  <div className="system-list-main">
                    <Typography.Text strong>{user.displayName}</Typography.Text>
                    <Typography.Text type="secondary">{user.username}</Typography.Text>
                    <Space size={6} wrap>
                      <Tag color={user.active ? "green" : "default"}>{user.active ? "active" : "disabled"}</Tag>
                      <Tag color={user.role === "admin" ? "blue" : "default"}>{user.role}</Tag>
                      <Tag>{unit?.name ?? user.organizationUnitId}</Tag>
                      {user.projectGroupIds.map((projectGroupId) => (
                        <Tag key={projectGroupId}>
                          {catalog.projectGroups.find((group) => group.projectGroupId === projectGroupId)?.name ?? projectGroupId}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                  <div className="account-row-actions">
                    <Select
                      aria-label={`${user.username} 角色`}
                      virtual={false}
                      options={ROLE_OPTIONS}
                      value={user.role}
                      onChange={(role) => changeUserRole(user, role)}
                    />
                    <Select
                      aria-label={`${user.username} 组织单元`}
                      virtual={false}
                      options={unitOptionsForRole(user.role, catalog.units)}
                      value={user.organizationUnitId}
                      onChange={(organizationUnitId) => void updateUser(user.userId, { organizationUnitId })}
                    />
                    <Select
                      aria-label={`${user.username} 项目组`}
                      mode="multiple"
                      virtual={false}
                      options={projectGroupOptions}
                      value={user.projectGroupIds}
                      onChange={(projectGroupIds) => void updateUser(user.userId, { projectGroupIds })}
                    />
                    <Switch
                      aria-label={`${user.username} 启用`}
                      checked={user.active}
                      loading={savingUserId === user.userId}
                      onChange={(active) => void updateUser(user.userId, { active })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <OrganizationAccessPanel onCatalogChange={handleCatalogChange} />
    </div>
  );

  async function refreshUsers(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api<PublicUser[]>("/api/internal/auth/users"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "账号列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(): Promise<void> {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const user = await api<PublicUser>("/api/internal/auth/users", {
        method: "POST",
        body: {
          ...draft,
          username: draft.username.trim(),
          displayName: draft.displayName.trim()
        }
      });
      setUsers((current) => [...current, user].sort((left, right) => left.username.localeCompare(right.username)));
      setDraft(createEmptyDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : "账号创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(userId: string, patch: UpdateUserRequest): Promise<void> {
    setSavingUserId(userId);
    setError(null);
    try {
      const user = await api<PublicUser>(`/api/internal/auth/users/${userId}`, {
        method: "PATCH",
        body: patch
      });
      setUsers((current) => current.map((item) => (item.userId === user.userId ? user : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "账号更新失败");
    } finally {
      setSavingUserId(null);
    }
  }

  function changeUserRole(user: PublicUser, role: UserRole): void {
    const organizationUnitId = preferredUnitIdForRole(role, catalog.units);
    if (!organizationUnitId) {
      setError(`没有可用于 ${role} 角色的活动组织单元`);
      return;
    }
    void updateUser(user.userId, { role, organizationUnitId });
  }

  function handleCatalogChange(nextCatalog: OrganizationCatalog): void {
    setCatalog(nextCatalog);
    setDraft((current) => {
      const currentUnitIsValid = unitOptionsForRole(current.role, nextCatalog.units).some(
        (option) => option.value === current.organizationUnitId
      );
      return currentUnitIsValid
        ? current
        : {
            ...current,
            organizationUnitId: preferredUnitIdForRole(current.role, nextCatalog.units) ?? ""
          };
    });
  }

  function setDraftField<Key extends keyof CreateUserDraft>(key: Key, value: CreateUserDraft[Key]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }
}

function filterUsers(users: PublicUser[], accounts?: string): PublicUser[] {
  if (accounts === "active") return users.filter((user) => user.active);
  if (accounts === "admin") return users.filter((user) => user.role === "admin");
  return users;
}

function accountFilterLabel(accounts?: string): string | undefined {
  if (accounts === "all") return "全部账号";
  if (accounts === "active") return "启用账号";
  if (accounts === "admin") return "管理员";
  return undefined;
}

function createEmptyDraft(): CreateUserDraft {
  return {
    username: "",
    password: "",
    displayName: "",
    role: "sales",
    organizationUnitId: DEFAULT_UNIT_BY_ROLE.sales,
    projectGroupIds: []
  };
}

function unitOptionsForRole(role: UserRole, units: OrganizationUnit[]): Array<{ label: string; value: string }> {
  const rootUnitId =
    role === "sales" ? DEFAULT_UNIT_BY_ROLE.sales : role === "technical" ? "org-technical" : DEFAULT_UNIT_BY_ROLE.admin;
  return units
    .filter((unit) => isUnitInActiveSubtree(unit.unitId, rootUnitId, units))
    .map((unit) => ({ label: unit.name, value: unit.unitId }));
}

function preferredUnitIdForRole(role: UserRole, units: OrganizationUnit[]): string | undefined {
  const options = unitOptionsForRole(role, units);
  const defaultUnitId = DEFAULT_UNIT_BY_ROLE[role];
  return options.some((option) => option.value === defaultUnitId) ? defaultUnitId : options[0]?.value;
}

function isUnitInActiveSubtree(unitId: string, rootUnitId: string, units: OrganizationUnit[]): boolean {
  const byId = new Map(units.map((unit) => [unit.unitId, unit]));
  const visited = new Set<string>();
  let current = byId.get(unitId);
  while (current?.active && !visited.has(current.unitId)) {
    if (current.unitId === rootUnitId) return true;
    visited.add(current.unitId);
    current = current.parentUnitId ? byId.get(current.parentUnitId) : undefined;
  }
  return false;
}
