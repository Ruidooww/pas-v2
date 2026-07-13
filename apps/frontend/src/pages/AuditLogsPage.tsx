import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Card, Input, Select, Space, Spin, Tag, Typography } from "antd";
import { api } from "../api";
import { MetricDrilldown } from "../components/MetricDrilldown";
import { useDrilldownQuery } from "../drilldown";
import type { AuditEvent } from "../types";

const RESULT_OPTIONS = [
  { label: "全部结果", value: "all" },
  { label: "success", value: "success" },
  { label: "failure", value: "failure" }
];
const auditDrilldownSchema = { result: ["all", "success", "failure"] } as const;

export function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, updateDrilldown] = useDrilldownQuery(auditDrilldownSchema);
  const eventListRef = useRef<HTMLDivElement>(null);
  const result = (drilldown.result as "all" | AuditEvent["result"] | undefined) ?? "all";

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
  const failureEvents = events.filter((event) => event.result === "failure").length;
  const actorCount = new Set(events.map((event) => event.actorUserId).filter(Boolean)).size;

  return (
    <div className="system-page">
      {error && <Alert type="error" showIcon title={error} closable onClose={() => setError(null)} />}
      <section className="system-hero">
        <div className="system-hero-copy">
          <Typography.Text className="system-eyebrow">AUDIT</Typography.Text>
          <Typography.Title level={3}>审计日志</Typography.Title>
          <Typography.Text type="secondary">追踪登录、权限、菜单和系统操作的可审计记录。</Typography.Text>
        </div>
        <MetricDrilldown className="system-hero-stat" label="事件总数" onClick={() => {
          setQuery("");
          updateDrilldown({ result: "all" });
        }}>
          <Typography.Text type="secondary">事件总数</Typography.Text>
          <strong>{events.length}</strong>
        </MetricDrilldown>
        <MetricDrilldown className="system-hero-stat" label="当前结果" onClick={() => eventListRef.current?.scrollIntoView?.({ block: "start" })}>
          <Typography.Text type="secondary">当前结果</Typography.Text>
          <strong>{filteredEvents.length}</strong>
        </MetricDrilldown>
        <MetricDrilldown className="system-hero-stat" label="失败事件" onClick={() => updateDrilldown({ result: "failure" })}>
          <Typography.Text type="secondary">失败事件</Typography.Text>
          <strong>{failureEvents}</strong>
        </MetricDrilldown>
      </section>

      <Card
        ref={eventListRef}
        className="pas-panel"
        title="事件列表"
        extra={
          <Space wrap>
            <Input.Search
              allowClear
              aria-label="搜索日志"
              placeholder="搜索 action / object / actor"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select aria-label="结果" options={RESULT_OPTIONS} value={result} onChange={(value) => updateDrilldown({ result: value })} />
          </Space>
        }
      >
        <Typography.Text className="system-filter-note" type="secondary">
          涉及主体 {actorCount} 个
        </Typography.Text>
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
