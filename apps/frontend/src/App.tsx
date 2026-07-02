import { CheckCircleOutlined, CloudServerOutlined, DatabaseOutlined, FileDoneOutlined } from "@ant-design/icons";
import { Card, ConfigProvider, Layout, Space, Tag, Typography } from "antd";
import "./styles.css";

const statusItems = [
  {
    icon: <CloudServerOutlined />,
    label: "Backend",
    value: "Ready for API modules"
  },
  {
    icon: <DatabaseOutlined />,
    label: "RAGFlow",
    value: "External stack"
  },
  {
    icon: <CheckCircleOutlined />,
    label: "CRM",
    value: "Mock adapter first"
  },
  {
    icon: <FileDoneOutlined />,
    label: "Export",
    value: "docx / pptx / xlsx"
  }
];

export function App() {
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
      <Layout className="app-shell">
        <Layout.Header className="app-header">
          <Space direction="vertical" size={2}>
            <Typography.Title level={1}>PAS</Typography.Title>
            <Typography.Text>Presales Assistance System</Typography.Text>
          </Space>
          <Tag color="processing">V0 Foundation</Tag>
        </Layout.Header>
        <Layout.Content className="app-content">
          <section className="status-grid" aria-label="System status">
            {statusItems.map((item) => (
              <Card key={item.label} className="status-card" size="small">
                <Space align="start">
                  <span className="status-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>{item.label}</Typography.Text>
                    <Typography.Text type="secondary">{item.value}</Typography.Text>
                  </Space>
                </Space>
              </Card>
            ))}
          </section>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
