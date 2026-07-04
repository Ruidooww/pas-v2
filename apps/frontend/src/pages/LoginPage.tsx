import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { api, setToken } from "../api";
import type { LoginResponse, PublicUser } from "../types";

type LoginPageProps = {
  onLogin: (user: PublicUser) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: values
      });
      setToken(response.accessToken);
      onLogin(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <Card className="login-card">
        <Typography.Title className="login-title" level={3}>
          PAS 售前辅助系统
        </Typography.Title>
        <Typography.Paragraph className="login-subtitle" type="secondary">
          账号由管理员分配，如无账号请联系管理员
        </Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
