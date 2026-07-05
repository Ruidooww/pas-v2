import { useEffect, useState } from "react";
import { Button, ConfigProvider, Layout, Menu, Space, Spin, Typography } from "antd";
import { DatabaseOutlined, FileDoneOutlined, MessageOutlined } from "@ant-design/icons";
import { api, clearToken, getToken } from "./api";
import { LoginPage } from "./pages/LoginPage";
import { KnowledgeBlocksPage } from "./pages/KnowledgeBlocksPage";
import { QaPage } from "./pages/QaPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import type { PublicUser } from "./types";
import "./styles.css";

type View = "qa" | "workbench" | "knowledge";

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
              selectedKeys={[view]}
              onClick={({ key }) => setView(key as View)}
              items={[
                { key: "workbench", icon: <FileDoneOutlined />, label: "客户与方案" },
                { key: "qa", icon: <MessageOutlined />, label: "知识库问答" },
                { key: "knowledge", icon: <DatabaseOutlined />, label: "知识块运营" }
              ]}
            />
            <div className="pas-sidebar-user">
              <Typography.Text type="secondary">{user.displayName}</Typography.Text>
              <Typography.Text type="secondary">（{user.role}）</Typography.Text>
            </div>
          </Layout.Sider>
          <Layout className="pas-main">
            <Layout.Header className="pas-topbar">
              <Typography.Title className="pas-view-title" level={3}>
                {view === "qa" ? "知识库问答" : view === "knowledge" ? "知识块运营" : "客户与方案"}
              </Typography.Title>
              <Space>
                <Button size="small" onClick={logout}>
                  退出登录
                </Button>
              </Space>
            </Layout.Header>
            <Layout.Content className="pas-content">
              {view === "qa" ? <QaPage /> : view === "knowledge" ? <KnowledgeBlocksPage /> : <WorkbenchPage />}
            </Layout.Content>
          </Layout>
        </Layout>
      )}
    </ConfigProvider>
  );
}
