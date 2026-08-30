"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Entry = {
  date: string;
  event: string;
  type: string;
};

export function DailyBriefing() {
  const [timeline, setTimeline] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/timeline");
        if (cancelled) return;
        const data: Entry[] = await res.json();
        if (cancelled) return;
        const sorted = data.sort((a, b) => b.date.localeCompare(a.date));
        const recent = sorted.slice(0, 5);
        setTimeline(recent);
        setLoading(false);

        const entries = sorted.slice(0, 10);
        const context = entries.map((e) => `[${e.date}] ${e.type} ${e.event}`).join("\n");
        const prompt = `以下是家庭近期的动态记录。请用一段话（50-80字）总结最近发生了什么，有什么值得关注的趋势或变化。

${context}`;

        setAiLoading(true);
        try {
          const aiRes = await fetch("/api/ai/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: prompt }),
          });
          if (cancelled) return;
          const aiData = await aiRes.json();
          if (aiData.answer && !cancelled) setAiSummary(aiData.answer);
        } catch {
          // AI summary is optional
        }
        setAiLoading(false);
      } catch {
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekDay = weekDays[today.getDay()];

  return (
    <div
      className="rounded-2xl border px-5 py-4 mb-4"
      style={{
        borderColor: "var(--family-primary)",
        background: "linear-gradient(135deg, var(--family-primary-soft) 0%, var(--family-surface) 100%)",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: "1.25rem" }}>📋</span>
            <h2 className="text-sm font-bold mb-0" style={{ color: "var(--family-text)" }}>
              每日简报
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--family-primary)", color: "#fff" }}>
              今日
            </span>
          </div>
          <p className="text-xs mb-0" style={{ color: "var(--family-text-2)" }}>
            {dateStr} · 星期{weekDay}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ask"
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline family-transition"
            style={{ borderColor: "var(--family-border)", background: "var(--family-surface)", color: "var(--family-text-2)" }}
          >
            🧠 提问
          </Link>
          <Link
            href="/timeline"
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline family-transition"
            style={{ borderColor: "var(--family-border)", background: "var(--family-surface)", color: "var(--family-text-2)" }}
          >
            📊 全部时间线
          </Link>
        </div>
      </div>

      {aiSummary && (
        <div className="mt-3 rounded-xl px-3 py-2" style={{ background: "rgba(47,111,95,0.06)" }}>
          <div className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--family-text-2)" }}>
            <span>🤖</span> AI 快讯
          </div>
          <p className="text-xs mb-0" style={{ color: "var(--family-text)", lineHeight: 1.6 }}>
            {aiSummary}
          </p>
        </div>
      )}

      {aiLoading && (
        <div className="mt-3 rounded-xl px-3 py-2" style={{ background: "rgba(47,111,95,0.04)" }}>
          <p className="text-xs mb-0" style={{ color: "var(--family-text-3)" }}>
            生成 AI 快讯…
          </p>
        </div>
      )}

      {!loading && timeline.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--family-text-3)" }}>
            最近动态
          </div>
          {timeline.map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-2"
              style={{ fontSize: "0.8125rem" }}
            >
              <span style={{ flexShrink: 0 }}>{entry.type.slice(0, 2)}</span>
              <span className="shrink-0 text-xs" style={{ color: "var(--family-text-3)", width: 76 }}>
                {entry.date}
              </span>
              <span className="truncate" style={{ color: "var(--family-text)", flex: 1, minWidth: 0 }}>
                {entry.event}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
