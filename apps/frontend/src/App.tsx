import { useEffect, useMemo, useState } from "react";
import { Button, ConfigProvider, Layout, Menu, Space, Spin, Typography } from "antd";
import { api, clearToken, getToken } from "./api";
import { AccountsPage } from "./pages/AccountsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { BusinessFlowsPage } from "./pages/BusinessFlowsPage";
import { DataAttachmentsPage } from "./pages/DataAttachmentsPage";
import { ExportTemplatesPage } from "./pages/ExportTemplatesPage";
import { LoginPage } from "./pages/LoginPage";
import { KnowledgeBlocksPage } from "./pages/KnowledgeBlocksPage";
import { KnowledgeDocumentsPage } from "./pages/KnowledgeDocumentsPage";
import { MenuConfigPage } from "./pages/MenuConfigPage";
import { PlatformPage } from "./pages/PlatformPage";
import { QaPage } from "./pages/QaPage";
import { SystemSettingsPage } from "./pages/SystemSettingsPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import {
  buildAntMenuItems,
  defaultSecondaryForPrimary,
  fallbackMenuFor,
  findPrimaryBySecondary,
  findSecondary,
  firstSecondaryKey,
  menuKeyToPrimaryKey,
  primaryKeyToMenuKey,
  routeToView,
  viewToTitle,
  type View
} from "./navigation";
import type { EffectivePrimaryMenuItem, PublicUser, SecondaryMenuKey } from "./types";
import "./styles.css";

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [menu, setMenu] = useState<EffectivePrimaryMenuItem[]>([]);
  const [activeSecondaryKey, setActiveSecondaryKey] = useState<SecondaryMenuKey | null>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    api<PublicUser>("/api/me")
      .then(async (nextUser) => {
        const nextMenu = await loadMenuForUser(nextUser);
        setUser(nextUser);
        applyMenu(nextMenu);
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setMenu([]);
        setActiveSecondaryKey(null);
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeSecondaryKey]);

  const activeSecondary = findSecondary(menu, activeSecondaryKey);
  const activePrimary = findPrimaryBySecondary(menu, activeSecondaryKey);
  const activeView = routeToView(activeSecondary?.route ?? "");
  const activeTitle = activeSecondary?.label ?? viewToTitle(activeView);
  const menuItems = useMemo(() => buildAntMenuItems(menu), [menu]);

  const handleLogin = async (nextUser: PublicUser) => {
    setUser(nextUser);
    applyMenu(await loadMenuForUser(nextUser));
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setMenu([]);
    setActiveSecondaryKey(null);
    setOpenKeys([]);
  };

  const navigateToSecondary = (key: SecondaryMenuKey | null) => {
    if (!key) return;
    setActiveSecondaryKey(key);
    const nextPrimary = findPrimaryBySecondary(menu, key);
    if (nextPrimary) {
      setOpenKeys([primaryKeyToMenuKey(nextPrimary.key)]);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 10,
          colorBgBase: "#ffffff",
          colorBgContainer: "#ffffff",
          colorBgLayout: "#f5f5f7",
          colorBorder: "#e5e5ea",
          colorPrimary: "#007aff",
          colorText: "#1d1d1f",
          colorTextSecondary: "#6e6e73",
          controlHeight: 36,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"PingFang SC\", \"Segoe UI\", sans-serif"
        }
      }}
    >
      {booting ? (
        <div className="pas-boot">
          <Spin size="large" />
        </div>
      ) : !user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Layout className="pas-shell">
          <Layout.Sider className="pas-sidebar" theme="light" width={214}>
            <div className="pas-brand-block">
              <span className="pas-brand-mark">P</span>
              <span>
                <Typography.Title className="pas-brand" level={4}>
                  PAS
                </Typography.Title>
                <Typography.Text className="pas-brand-caption">Pre-Sales Assistant</Typography.Text>
              </span>
            </div>
            <Menu
              className="pas-menu"
              mode="inline"
              items={menuItems}
              openKeys={openKeys}
              selectedKeys={activeSecondaryKey ? [activeSecondaryKey] : []}
              onClick={({ key }) => {
                const primaryKey = menuKeyToPrimaryKey(String(key));
                if (primaryKey) {
                  navigateToSecondary(defaultSecondaryForPrimary(menu, primaryKey));
                  return;
                }
                navigateToSecondary(key as SecondaryMenuKey);
              }}
              onOpenChange={(keys) => {
                const latestKey = keys.find((key) => !openKeys.includes(String(key))) ?? keys[keys.length - 1];
                setOpenKeys(latestKey ? [String(latestKey)] : []);
                const primaryKey = latestKey ? menuKeyToPrimaryKey(String(latestKey)) : null;
                const defaultKey = primaryKey ? defaultSecondaryForPrimary(menu, primaryKey) : null;
                if (defaultKey) {
                  setActiveSecondaryKey(defaultKey);
                }
              }}
            />
            <div className="pas-sidebar-user">
              <Typography.Text>{user.displayName}</Typography.Text>
              <Typography.Text type="secondary">({user.role})</Typography.Text>
            </div>
          </Layout.Sider>
          <Layout className="pas-main">
            <Layout.Header className="pas-topbar">
              <div>
                <Typography.Text className="pas-view-kicker">
                  {activePrimary?.label ?? "PAS"}
                </Typography.Text>
                <Typography.Title className="pas-view-title" level={3}>
                  {activeTitle}
                </Typography.Title>
              </div>
              <Space>
                <Button size="small" onClick={logout}>
                  退出登录
                </Button>
              </Space>
            </Layout.Header>
            <Layout.Content className="pas-content">{renderActiveContent(activeView, user)}</Layout.Content>
          </Layout>
        </Layout>
      )}
    </ConfigProvider>
  );

  function applyMenu(nextMenu: EffectivePrimaryMenuItem[]): void {
    setMenu(nextMenu);
    const nextActiveKey = firstSecondaryKey(nextMenu);
    setActiveSecondaryKey(nextActiveKey);
    const nextPrimary = findPrimaryBySecondary(nextMenu, nextActiveKey);
    setOpenKeys(nextPrimary ? [primaryKeyToMenuKey(nextPrimary.key)] : []);
  }
}

async function loadMenuForUser(user: PublicUser): Promise<EffectivePrimaryMenuItem[]> {
  try {
    const remoteMenu = await api<EffectivePrimaryMenuItem[]>("/api/internal/menu/effective");
    return remoteMenu.length ? remoteMenu : fallbackMenuFor(user);
  } catch {
    return fallbackMenuFor(user);
  }
}

function renderActiveContent(view: View, user: PublicUser) {
  switch (view) {
    case "qa":
      return <QaPage />;
    case "business":
      return <BusinessFlowsPage />;
    case "platform":
      return <PlatformPage user={user} />;
    case "knowledge":
      return <KnowledgeBlocksPage />;
    case "documents":
      return <KnowledgeDocumentsPage />;
    case "templates":
      return <ExportTemplatesPage />;
    case "accounts":
      return <AccountsPage />;
    case "auditLogs":
      return <AuditLogsPage />;
    case "dataAttachments":
      return <DataAttachmentsPage />;
    case "systemSettings":
      return <SystemSettingsPage />;
    case "menuConfig":
      return <MenuConfigPage />;
    default:
      return <WorkbenchPage />;
  }
}
