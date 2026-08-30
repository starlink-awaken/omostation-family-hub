"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

type MonthlyCost = {
  month: string;
  total: number;
  count: number;
  items: string[];
};

type Props = {
  height?: number;
};

export function CostTrendChart({ height = 200 }: Props) {
  const [data, setData] = useState<MonthlyCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cost-trend")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height, color: "var(--family-text-3)" }}>
        <span className="text-xs">加载费用数据…</span>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--family-text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--family-text-3)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `¥${(Number(v) / 10000).toFixed(1)}w`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--family-surface)",
              border: "1px solid var(--family-border)",
              borderRadius: 8,
              fontSize: "0.8125rem",
              boxShadow: "var(--family-shadow-float)",
            }}
            formatter={(value) => `¥${Number(value).toLocaleString()}`}
            labelFormatter={(label) => `${label} 月`}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.total > maxTotal * 0.7 ? "#b95852" : entry.total > maxTotal * 0.4 ? "#c5892f" : "#2f8f68"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {data.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: "var(--family-text-3)" }}>
          {data.map((d) => (
            <span key={d.month} className="inline-flex items-center gap-1">
              <span
                className="inline-block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: d.total > maxTotal * 0.7 ? "#b95852" : d.total > maxTotal * 0.4 ? "#c5892f" : "#2f8f68",
                }}
              />
              {d.month}: ¥{d.total.toLocaleString()}（{d.count} 笔）
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
