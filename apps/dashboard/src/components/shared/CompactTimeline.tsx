"use client";

import { useEffect, useState } from "react";
import { TimelineBar } from "./TimelineChart";

type Entry = {
  date: string;
  event: string;
  type: string;
};

type Props = {
  title?: string;
  filterType?: string;
  maxEvents?: number;
  height?: number;
};

export function CompactTimeline({ title = "近期动态", filterType, maxEvents = 8, height = 120 }: Props) {
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/timeline")
      .then((r) => r.json())
      .then((all: Entry[]) => {
        const filtered = filterType
          ? all.filter((e) => e.type.startsWith(filterType))
          : all;
        setData(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterType]);

  if (loading) {
    return (
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>{title}</h3>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>加载中…</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>{title}</h3>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>暂无动态</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, maxEvents);

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--family-text)" }}>
        <span>📅</span> {title}
        <span className="text-xs font-normal" style={{ color: "var(--family-text-3)" }}>
          · {data.length} 条
        </span>
      </h3>
      <TimelineBar data={data} height={height} />
      <div className="flex flex-col gap-1.5 mt-3">
        {recent.map((entry, i) => (
          <div
            key={i}
            className="flex items-start gap-2 py-1"
            style={{ fontSize: "0.8125rem" }}
          >
            <span style={{ flexShrink: 0, width: 20, textAlign: "center" }}>
              {entry.type.slice(0, 2)}
            </span>
            <span className="shrink-0" style={{ color: "var(--family-text-3)", width: 76, fontSize: "0.75rem" }}>
              {entry.date}
            </span>
            <span style={{ color: "var(--family-text)", flex: 1, minWidth: 0 }} className="truncate">
              {entry.event}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
