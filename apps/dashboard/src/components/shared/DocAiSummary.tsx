"use client";

import { useEffect, useState } from "react";

type SummaryData = {
  summary: string;
  wordCount: number;
  headings: string[];
  fromCache?: boolean;
};

type Props = {
  docPath: string;
  fallbackSummary: string;
};

export function DocAiSummary({ docPath, fallbackSummary }: Props) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/ai/summarize-doc?path=${encodeURIComponent(docPath)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.summary) {
          setData({
            summary: d.summary,
            wordCount: d.wordCount || 0,
            headings: d.headings || [],
            fromCache: d.fromCache,
          });
        } else {
          setError(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [docPath]);

  const summaryText = data?.summary || fallbackSummary;

  return (
    <div
      className="rounded-2xl border mt-4"
      style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
    >
      <div
        className="flex items-center gap-2 px-4 pt-3 pb-2 border-b"
        style={{ borderColor: "var(--family-border)" }}
      >
        <span style={{ fontSize: "1rem", lineHeight: 1 }}>🤖</span>
        <span className="text-xs font-semibold" style={{ color: "var(--family-text-2)" }}>
          AI 摘要
        </span>
        {loading && (
          <span className="text-[10px]" style={{ color: "var(--family-text-3)" }}>
            分析中…
          </span>
        )}
        {data?.wordCount ? (
          <span className="text-[10px] ml-auto" style={{ color: "var(--family-text-3)" }}>
            {data.wordCount} 字 · {data.headings.length} 节
          </span>
        ) : null}
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            <div
              className="h-3 rounded"
              style={{
                background: "var(--family-surface-2)",
                width: "100%",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <div
              className="h-3 rounded"
              style={{
                background: "var(--family-surface-2)",
                width: "85%",
                animation: "pulse 1.5s ease-in-out infinite 0.2s",
              }}
            />
            <div
              className="h-3 rounded"
              style={{
                background: "var(--family-surface-2)",
                width: "60%",
                animation: "pulse 1.5s ease-in-out infinite 0.4s",
              }}
            />
          </div>
        ) : (
          <p
            className="text-sm mb-0 whitespace-pre-line"
            style={{ color: "var(--family-text-2)", lineHeight: 1.7 }}
          >
            {error ? fallbackSummary : summaryText}
          </p>
        )}
      </div>
    </div>
  );
}
