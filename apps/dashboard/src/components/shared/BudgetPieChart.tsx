"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "#2f8f68",
  "#c5892f",
  "#b95852",
  "#4a7b9d",
  "#8b6faf",
  "#cd853f",
  "#5f9ea0",
  "#b08d57",
];

type BudgetItem = {
  name: string;
  target: number;
  note: string;
};

type Props = {
  data: BudgetItem[];
  height?: number;
};

export function BudgetPieChart({ data, height = 220 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height, color: "var(--family-text-3)" }}>
        <span className="text-xs">暂无预算数据</span>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.target, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width="100%" height={height} className="shrink-0" style={{ maxWidth: 240 }}>
        <PieChart>
          <Pie
            data={data}
            dataKey="target"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--family-surface)",
              border: "1px solid var(--family-border)",
              borderRadius: 8,
              fontSize: "0.8125rem",
              boxShadow: "var(--family-shadow-float)",
            }}
            formatter={(value) => `${value}%`}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--family-text-2)" }}>
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="inline-block rounded-full shrink-0"
              style={{ width: 8, height: 8, background: COLORS[i % COLORS.length] }}
            />
            <span>{item.name}</span>
            <span className="font-semibold" style={{ color: "var(--family-text)" }}>{item.target}%</span>
          </div>
        ))}
        <div className="mt-1 pt-1 border-t" style={{ borderColor: "var(--family-border)" }}>
          <span className="text-xs" style={{ color: "var(--family-text-3)" }}>总计：{total}%</span>
        </div>
      </div>
    </div>
  );
}
