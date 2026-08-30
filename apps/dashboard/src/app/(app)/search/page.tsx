"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Card } from "@/components/shared/Card";

type ApiResult = {
  id: string;
  path: string;
  title: string;
  excerpt: string;
  text: string;
  tags: string[];
  score: number;
};

const DOMAINS = ["全部", "医疗健康", "育儿成长", "家庭日常", "资产管理", "档案"];

function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  return text.replace(re, "<mark style='background:#f5e6b8;color:#333;border-radius:2px'>$1</mark>");
}

function getDocDomain(path: string): string {
  if (path.startsWith("_archive")) return "档案";
  const m = path.match(/^_knowledge\/(\d+)/);
  if (!m) return "其他";
  const map: Record<string, string> = {
    "01": "成员档案", "02": "医疗健康", "03": "育儿成长",
    "04": "家庭日常", "05": "资产管理", "06": "事件记录",
  };
  return map[m[1]] || "其他";
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState("全部");
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 50 }),
      });
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const filtered = domain === "全部"
    ? results
    : results.filter((r) => getDocDomain(r.path) === domain);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
        🔍 全文搜索
      </h1>
      <p className="text-xs mb-4" style={{ color: "var(--family-text-3)" }}>
        在全部家庭文档中搜索 · 支持语义匹配
      </p>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索…"
            className="flex-1 border-0 rounded-lg px-3 py-2 outline-none text-sm"
            style={{ background: "var(--family-surface)", color: "var(--family-text)" }}
          />
          <button
            type="submit"
            className="border-0 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--family-primary)", color: "#fff", cursor: "pointer" }}
          >
            {loading ? "搜索中…" : "搜索"}
          </button>
        </div>
      </form>

      {searched && filtered.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className="border-0 rounded-full px-2.5 py-0.5 text-xs family-transition"
              style={{
                background: domain === d ? "var(--family-primary)" : "var(--family-surface-2)",
                color: domain === d ? "#fff" : "var(--family-text-2)",
                cursor: "pointer",
              }}
            >
              {d}
              {d !== "全部" && `(${results.filter((r) => getDocDomain(r.path) === d).length})`}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm" style={{ color: "var(--family-text-3)" }}>搜索中…</span>
        </div>
      )}

      {!loading && searched && filtered.length === 0 && (
        <Card padding="md">
          <p className="text-sm text-center" style={{ color: "var(--family-text-3)" }}>
            {results.length === 0 ? "无结果，试试其他关键词" : "当前领域无结果"}
          </p>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map((r) => (
            <a
              key={r.path}
              href={`/doc?path=${encodeURIComponent(r.path)}`}
              className="block no-underline"
            >
              <Card padding="md" hover>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm font-semibold mb-0.5 truncate"
                      style={{ color: "var(--family-text)" }}
                      dangerouslySetInnerHTML={{
                        __html: highlightText(r.title || r.path.split("/").pop() || "", query),
                      }}
                    />
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--family-text-2)" }}
                      dangerouslySetInnerHTML={{
                        __html: highlightText(r.excerpt || "", query),
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "var(--family-surface-2)", color: "var(--family-text-3)" }}
                    >
                      {getDocDomain(r.path)}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--family-text-3)" }}>
                      {Math.round(r.score)}
                    </span>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
