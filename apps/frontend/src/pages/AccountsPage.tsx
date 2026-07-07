import { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Select, Space, Spin, Switch, Tag, Typography } from "antd";
import { api } from "../api";
import type { PublicUser, UpdateUserRequest, UserRole } from "../types";

const ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: "sales", value: "sales" },
  { label: "presales", value: "presales" },
  { label: "admin", value: "admin" }
];

type CreateUserDraft = {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
};

const EMPTY_DRAFT: CreateUserDraft = {
  username: "",
  password: "",
  displayName: "",
  role: "sales"
};

export function AccountsPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [draft, setDraft] = useState<CreateUserDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshUsers();
  }, []);

  const activeUsers = users.filter((user) => user.active).length;
  const adminUsers = users.filter((user) => user.role === "admin").length;

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">ACCESS</Typography.Text>
          <Typography.Title level={3}>账号权限</Typography.Title>
          <Typography.Text type="secondary">统一管理登录账号、角色边界和启用状态。</Typography.Text>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">账号总数</Typography.Text>
          <strong>{users.length}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">启用账号</Typography.Text>
          <strong>{activeUsers}</strong>
        </div>
        <div className="system-hero-stat">
          <Typography.Text type="secondary">管理员</Typography.Text>
          <strong>{adminUsers}</strong>
        </div>
      </section>

      <Card className="pas-panel" title="创建账号">
        <div className="system-form-grid">
          <Input
            aria-label="账号"
            placeholder="账号"
            value={draft.username}
            onChange={(event) => setDraftField("username", event.target.value)}
          />
          <Input
            aria-label="姓名"
            placeholder="姓名"
            value={draft.displayName}
            onChange={(event) => setDraftField("displayName", event.target.value)}
          />
          <Input.Password
            aria-label="初始密码"
            placeholder="初始密码"
            value={draft.password}
            onChange={(event) => setDraftField("password", event.target.value)}
          />
          <Select aria-label="角色" options={ROLE_OPTIONS} value={draft.role} onChange={(role) => setDraftField("role", role)} />
          <Button type="primary" loading={creating} onClick={() => void createUser()}>
            创建账号
          </Button>
        </div>
      </Card>

      <Card className="pas-panel" title="账号列表">
        {loading ? (
          <div className="system-loading">
            <Spin />
          </div>
        ) : (
          <div className="system-list">
            {users.map((user) => (
              <div className="system-list-item" key={user.userId}>
                <div className="system-list-main">
                  <Typography.Text strong>{user.displayName}</Typography.Text>
                  <Typography.Text type="secondary">{user.username}</Typography.Text>
                  <Space size={6} wrap>
                    <Tag color={user.active ? "green" : "default"}>{user.active ? "active" : "disabled"}</Tag>
                    <Tag color={user.role === "admin" ? "blue" : "default"}>{user.role}</Tag>
                  </Space>
                </div>
                <div className="system-row-actions">
                  <Select
                    aria-label={`${user.username} 角色`}
                    options={ROLE_OPTIONS}
                    value={user.role}
                    onChange={(role) => void updateUser(user.userId, { role })}
                  />
                  <Switch
                    aria-label={`${user.username} 启用`}
                    checked={user.active}
                    loading={savingUserId === user.userId}
                    onChange={(active) => void updateUser(user.userId, { active })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
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
    setCreating(true);
    setError(null);
    try {
      const user = await api<PublicUser>("/api/internal/auth/users", {
        method: "POST",
        body: draft
      });
      setUsers((current) => [...current, user].sort((left, right) => left.username.localeCompare(right.username)));
      setDraft(EMPTY_DRAFT);
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

  function setDraftField<Key extends keyof CreateUserDraft>(key: Key, value: CreateUserDraft[Key]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }
}
