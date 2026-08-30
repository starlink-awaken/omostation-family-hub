"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { GrowthRecord } from "@/app/api/growth-curve/route";

type Props = {
  height?: number;
};

export function GrowthCurveChart({ height = 280 }: Props) {
  const [data, setData] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/growth-curve")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height, color: "var(--family-text-3)" }}>
        <span className="text-xs">加载成长数据…</span>
      </div>
    );
  }

  const chartData = data
    .filter((r) => r.weight !== null || r.height !== null)
    .map((r) => ({
      age: r.ageLabel,
      ageDays: r.ageDays,
      weight: r.weight,
      height: r.height,
    }));

  const hasHeight = chartData.some((r) => r.height !== null);
  const hasWeight = chartData.some((r) => r.weight !== null);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--family-border)" strokeOpacity={0.3} />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 10, fill: "var(--family-text-3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="weight"
            orientation="left"
            tick={{ fontSize: 10, fill: "var(--family-text-3)" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "体重 (kg)", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "var(--family-text-3)" } }}
          />
          {hasHeight && (
            <YAxis
              yAxisId="height"
              orientation="right"
              tick={{ fontSize: 10, fill: "var(--family-text-3)" }}
              axisLine={false}
              tickLine={false}
              label={{ value: "身长 (cm)", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "var(--family-text-3)" } }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "var(--family-surface)",
              border: "1px solid var(--family-border)",
              borderRadius: 8,
              fontSize: "0.8125rem",
              boxShadow: "var(--family-shadow-float)",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "0.75rem", color: "var(--family-text-2)" }}
          />
          {hasWeight && (
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weight"
              stroke="#2f8f68"
              strokeWidth={2}
              dot={{ r: 3, fill: "#2f8f68" }}
              name="体重 (kg)"
              connectNulls
            />
          )}
          {hasHeight && (
            <Line
              yAxisId="height"
              type="monotone"
              dataKey="height"
              stroke="#4b7a9f"
              strokeWidth={2}
              dot={{ r: 3, fill: "#4b7a9f" }}
              name="身长 (cm)"
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs" style={{ color: "var(--family-text-3)" }}>
        {data.length} 次测量记录 · Synthetic Member 02（2025-10-16 出生）
      </div>
    </div>
  );
}
