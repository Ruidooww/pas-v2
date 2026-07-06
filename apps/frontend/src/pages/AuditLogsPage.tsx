import { useEffect, useMemo, useState } from "react";
import { Alert, Card, Input, Select, Space, Spin, Tag, Typography } from "antd";
import { api } from "../api";
import type { AuditEvent } from "../types";

const RESULT_OPTIONS = [
  { label: "全部结果", value: "all" },
  { label: "success", value: "success" },
  { label: "failure", value: "failure" }
];

export function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<"all" | AuditEvent["result"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events
      .filter((event) => result === "all" || event.result === result)
      .filter((event) => {
        if (!normalizedQuery) return true;
        return [event.action, event.actorUserId, event.objectType, event.objectId, event.failureReason]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }, [events, query, result]);

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />}
      <Card
        className="pas-panel"
        title="日志中心"
        extra={
          <Space wrap>
            <Input.Search
              allowClear
              aria-label="搜索日志"
              placeholder="搜索 action / object / actor"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select aria-label="结果" options={RESULT_OPTIONS} value={result} onChange={setResult} />
          </Space>
        }
      >
        {loading ? (
          <div className="system-loading">
            <Spin />
          </div>
        ) : (
          <div className="system-list">
            {filteredEvents.map((event) => (
              <div className="system-list-item" key={event.auditId}>
                <div className="system-list-main">
                  <Space size={8} wrap>
                    <Typography.Text strong>{event.action}</Typography.Text>
                    <Tag color={event.result === "success" ? "green" : "red"}>{event.result}</Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    {event.objectType} / {event.objectId}
                  </Typography.Text>
                  {event.failureReason && <Typography.Text type="danger">{event.failureReason}</Typography.Text>}
                </div>
                <div className="system-list-meta">
                  <Typography.Text type="secondary">{formatTime(event.occurredAt)}</Typography.Text>
                  {event.actorUserId && <Typography.Text type="secondary">{event.actorUserId}</Typography.Text>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  async function refreshEvents(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setEvents(await api<AuditEvent[]>("/api/internal/audit/events"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "日志加载失败");
    } finally {
      setLoading(false);
    }
  }
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
