"use client";

import { useState } from "react";
import { TimelineBar, TimelineList } from "@/components/shared/TimelineChart";
import { Card } from "@/components/shared/Card";

type Entry = {
  date: string;
  event: string;
  type: string;
};

const TYPE_FILTERS = [
  { label: "全部", value: "" },
  { label: "✅ 完成", value: "✅" },
  { label: "💰 财务", value: "💰" },
  { label: "🔄 进行", value: "🔄" },
  { label: "🏥 健康", value: "🏥" },
  { label: "⚠️ 告警", value: "⚠️" },
  { label: "📊 分析", value: "📊" },
];

export function TimelineClient({ data }: { data: Entry[] }) {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? data.filter((e) => e.type.startsWith(filter))
    : data;

  return (
    <>
      <div className="mb-4">
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
          📊 家庭时间线
        </h1>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
          {data.length} 条事件 · 时间分布可视化
        </p>
      </div>

      <Card className="mb-4">
        <TimelineBar data={filtered} height={220} />
      </Card>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {TYPE_FILTERS.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setFilter(tf.value)}
            className="border-0 rounded-full px-3 py-1.5 text-xs font-semibold family-transition"
            style={{
              background: filter === tf.value ? "var(--family-primary)" : "var(--family-surface-2)",
              color: filter === tf.value ? "#fff" : "var(--family-text-2)",
              cursor: "pointer",
            }}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <Card padding="sm">
        <TimelineList data={filtered} />
      </Card>
    </>
  );
}
