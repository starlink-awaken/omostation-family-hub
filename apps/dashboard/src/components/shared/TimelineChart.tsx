"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type TimelineEntry = {
  date: string;
  event: string;
  type: string;
  category?: string;
};

type Props = {
  data: TimelineEntry[];
  height?: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  "✅": "#2f8f68",
  "💰": "#c5892f",
  "🔄": "#4b7a9f",
  "⚠️": "#b95852",
  "🏥": "#7fb2dd",
  "📊": "#6ab59d",
  "📋": "#5e6a66",
  "💼": "#4b7a9f",
  "💬": "#7b857f",
  "🛒": "#c5892f",
  "🔧": "#b95852",
  "🔜": "#4b7a9f",
  "🟢": "#2f8f68",
  "🟡": "#e0b05e",
};

function getColor(type: string): string {
  const emoji = type.slice(0, 2);
  return CATEGORY_COLORS[emoji] || "#7b857f";
}

function parseMonth(d: string): string {
  const m = d.match(/(\d{4})-(\d{1,2})/);
  return m ? `${m[1]}.${m[2].padStart(2, "0")}` : d;
}

export function TimelineBar({ data, height = 300 }: Props) {
  const grouped: Record<string, { month: string; count: number; fill: string }> = {};
  for (const entry of data) {
    const month = parseMonth(entry.date);
    if (!grouped[month]) {
      grouped[month] = { month, count: 0, fill: getColor(entry.type) };
    }
    grouped[month].count++;
  }
  const chartData = Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7b857f" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7b857f" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: "var(--family-surface)",
            border: "1px solid var(--family-border)",
            borderRadius: 8,
            fontSize: "0.8125rem",
            boxShadow: "var(--family-shadow-float)",
          }}
          formatter={(value) => `${value} 条事件`}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TimelineList({ data }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {data.map((entry, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-2 py-1.5 rounded"
          style={{ fontSize: "0.8125rem" }}
        >
          <span className="shrink-0" style={{ width: 20, textAlign: "center" }}>
            {entry.type.slice(0, 2)}
          </span>
          <span className="shrink-0 text-xs" style={{ color: "var(--family-text-3)", width: 80 }}>
            {entry.date}
          </span>
          <span style={{ color: "var(--family-text)", flex: 1, minWidth: 0 }}>
            {entry.event}
          </span>
        </div>
      ))}
    </div>
  );
}
