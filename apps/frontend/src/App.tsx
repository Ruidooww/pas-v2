import { useEffect, useState } from "react";
import { Button, ConfigProvider, Layout, Menu, Space, Spin, Typography } from "antd";
import { FileDoneOutlined, MessageOutlined } from "@ant-design/icons";
import { api, clearToken, getToken } from "./api";
import { LoginPage } from "./pages/LoginPage";
import { QaPage } from "./pages/QaPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import type { PublicUser } from "./types";
import "./styles.css";

type View = "qa" | "workbench";

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("qa");

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
          borderRadius: 6,
          colorPrimary: "#1677ff",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
        }
      }}
    >
      {booting ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 160 }}>
          <Spin size="large" />
        </div>
      ) : !user ? (
        <LoginPage onLogin={setUser} />
      ) : (
        <Layout style={{ minHeight: "100vh" }}>
          <Layout.Sider theme="light" width={200}>
            <Typography.Title level={4} style={{ padding: "16px 16px 0" }}>
              PAS
            </Typography.Title>
            <Menu
              mode="inline"
              selectedKeys={[view]}
              onClick={({ key }) => setView(key as View)}
              items={[
                { key: "qa", icon: <MessageOutlined />, label: "知识库问答" },
                { key: "workbench", icon: <FileDoneOutlined />, label: "客户与方案" }
              ]}
            />
          </Layout.Sider>
          <Layout>
            <Layout.Header
              style={{
                background: "#fff",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                paddingInline: 24
              }}
            >
              <Space>
                <Typography.Text>
                  {user.displayName}（{user.role}）
                </Typography.Text>
                <Button size="small" onClick={logout}>
                  退出登录
                </Button>
              </Space>
            </Layout.Header>
            <Layout.Content style={{ padding: 24, maxWidth: 1080, width: "100%", margin: "0 auto" }}>
              {view === "qa" ? <QaPage /> : <WorkbenchPage />}
            </Layout.Content>
          </Layout>
        </Layout>
      )}
    </ConfigProvider>
  );
}
