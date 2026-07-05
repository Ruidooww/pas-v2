import { useState } from "react";
import { Alert, Button, Card, Empty, Input, List, message, Space, Tag, Typography } from "antd";
import { DislikeOutlined, LikeOutlined } from "@ant-design/icons";
import { api } from "../api";
import type { QaAskResponse } from "../types";

export function QaPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<QaAskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api<QaAskResponse>("/api/internal/qa/ask", {
        method: "POST",
        body: { query: query.trim() }
      });
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提问失败");
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (rating: 1 | 5) => {
    if (!response) return;
    try {
      await api("/api/internal/feedback", {
        method: "POST",
        body: {
          objectType: "qa_answer",
          objectId: response.questionId,
          rating,
          issueType: rating >= 4 ? "other" : "retrieval",
          comment: rating >= 4 ? "有用" : "无用或不准确"
        }
      });
      message.success("反馈已提交");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "反馈提交失败");
    }
  };

  return (
    <Space className="pas-page-stack" orientation="vertical" size="middle">
      <Card className="pas-panel pas-input-panel" title="知识库问答">
        <Space.Compact style={{ width: "100%" }}>
          <Input.TextArea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入产品、方案、场景相关的问题，例如：IP-Guard 的文档加密支持哪些模式？"
            autoSize={{ minRows: 2, maxRows: 4 }}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void ask();
              }
            }}
          />
        </Space.Compact>
        <Button type="primary" onClick={() => void ask()} loading={loading} style={{ marginTop: 12 }}>
          提问
        </Button>
      </Card>

      {error && <Alert type="error" message={error} />}

      {response && (
        <Card
          className="pas-panel"
          title="回答"
          extra={
            <Space>
              <Button icon={<LikeOutlined />} size="small" onClick={() => void submitFeedback(5)}>
                有用
              </Button>
              <Button icon={<DislikeOutlined />} size="small" onClick={() => void submitFeedback(1)}>
                无用
              </Button>
            </Space>
          }
        >
          <Alert
            type="warning"
            message="AI 生成内容，需人工核实后使用"
            style={{ marginBottom: 12 }}
            showIcon
          />
          {response.status === "no_hit" ? (
            <Empty description="知识库中没有足够资料回答该问题，请补充资料或人工确认" />
          ) : (
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{response.answer}</Typography.Paragraph>
          )}
          {response.citations.length > 0 && (
            <List
              header="引用来源"
              size="small"
              dataSource={response.citations}
              renderItem={(citation, index) => (
                <List.Item>
                  <Space className="citation-row">
                    <Tag>[{index + 1}]</Tag>
                    <Typography.Text strong>{citation.title}</Typography.Text>
                    <Typography.Text type="secondary">
                      {citation.source}
                      {citation.page !== undefined ? ` · p.${citation.page}` : ""}
                      {` · 相关度 ${(citation.score * 100).toFixed(0)}%`}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
      )}
    </Space>
  );
}
