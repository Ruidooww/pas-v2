import { useEffect, useState, type ReactNode } from "react";
import { Button, ConfigProvider, Layout, Menu, Space, Spin, Typography } from "antd";
import {
  ApartmentOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  MessageOutlined
} from "@ant-design/icons";
import { api, clearToken, getToken } from "./api";
import { BusinessFlowsPage } from "./pages/BusinessFlowsPage";
import { ExportTemplatesPage } from "./pages/ExportTemplatesPage";
import { LoginPage } from "./pages/LoginPage";
import { KnowledgeBlocksPage } from "./pages/KnowledgeBlocksPage";
import { KnowledgeDocumentsPage } from "./pages/KnowledgeDocumentsPage";
import { PlatformPage } from "./pages/PlatformPage";
import { QaPage } from "./pages/QaPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import type { PublicUser } from "./types";
import "./styles.css";

type View = "qa" | "workbench" | "business" | "platform" | "knowledge" | "documents" | "templates";

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("workbench");

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    api<PublicUser>("/api/me")
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setBooting(false));
  }, []);

  const logout = () => {
    clearToken();
    setUser(null);
  };
  const menuItems = user ? menuItemsFor(user) : [];
  const activeView = menuItems.some((item) => item.key === view) ? view : "workbench";

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
        <LoginPage onLogin={setUser} />
      ) : (
        <Layout className="pas-shell">
          <Layout.Sider className="pas-sidebar" theme="light" width={188}>
            <Typography.Title className="pas-brand" level={4}>
              PAS
            </Typography.Title>
            <Menu
              className="pas-menu"
              mode="inline"
              selectedKeys={[activeView]}
              onClick={({ key }) => setView(key as View)}
              items={menuItems}
            />
            <div className="pas-sidebar-user">
              <Typography.Text type="secondary">{user.displayName}</Typography.Text>
              <Typography.Text type="secondary">（{user.role}）</Typography.Text>
            </div>
          </Layout.Sider>
          <Layout className="pas-main">
            <Layout.Header className="pas-topbar">
              <Typography.Title className="pas-view-title" level={3}>
                {activeView === "qa"
                  ? "知识库问答"
                  : activeView === "business"
                    ? "V2 业务闭环"
                    : activeView === "platform"
                      ? "V3 平台化"
                  : activeView === "knowledge"
                    ? "知识块运营"
                    : activeView === "documents"
                      ? "文档运营"
                      : activeView === "templates"
                        ? "模板运营"
                        : "客户与方案"}
              </Typography.Title>
              <Space>
                <Button size="small" onClick={logout}>
                  退出登录
                </Button>
              </Space>
            </Layout.Header>
            <Layout.Content className="pas-content">
              {activeView === "qa" ? (
                <QaPage />
              ) : activeView === "business" ? (
                <BusinessFlowsPage />
              ) : activeView === "platform" ? (
                <PlatformPage user={user} />
              ) : activeView === "knowledge" ? (
                <KnowledgeBlocksPage />
              ) : activeView === "documents" ? (
                <KnowledgeDocumentsPage />
              ) : activeView === "templates" ? (
                <ExportTemplatesPage />
              ) : (
                <WorkbenchPage />
              )}
            </Layout.Content>
          </Layout>
        </Layout>
      )}
    </ConfigProvider>
  );
}

function menuItemsFor(user: PublicUser): Array<{ key: View; icon: ReactNode; label: string }> {
  const items: Array<{ key: View; icon: ReactNode; label: string }> = [
    { key: "workbench", icon: <FileDoneOutlined />, label: "客户与方案" },
    { key: "business", icon: <ApartmentOutlined />, label: "V2 业务闭环" },
    { key: "qa", icon: <MessageOutlined />, label: "知识库问答" }
  ];
  if (user.role === "admin" || user.role === "presales") {
    items.splice(2, 0, { key: "platform", icon: <ClusterOutlined />, label: "V3 平台化" });
    items.push(
      { key: "documents", icon: <FileSearchOutlined />, label: "文档运营" },
      { key: "knowledge", icon: <DatabaseOutlined />, label: "知识块运营" },
      { key: "templates", icon: <FileTextOutlined />, label: "模板运营" }
    );
  }
  return items;
}
