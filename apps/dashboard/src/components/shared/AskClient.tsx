"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { scoreDoc, highlightText } from "@/lib/search";
import type { SearchDoc } from "@/lib/search";

const SUGGESTIONS = [
  { label: "Synthetic Member 02身高体重", query: "Synthetic Member 02身高体重生长发育情况" },
  { label: "理想 i6 信息", query: "理想i6车牌号车辆信息" },
  { label: "最近动态", query: "家庭近况" },
  { label: "医疗汇总", query: "医疗汇总" },
  { label: "资产清单", query: "资产清单" },
];

export default function AskClient({ initialDocs }: { initialDocs: SearchDoc[] }) {
  const [docs] = useState<SearchDoc[]>(initialDocs);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchDoc[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_aiSources, setAiSources] = useState<{ title: string; path: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_aiDone, setAiDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setSelectedIdx(-1); return; }
    const scored = docs
      .map((doc) => ({ doc, score: scoreDoc(doc, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((r) => r.doc);
    setResults(scored);
    setSelectedIdx(-1);
  }, [docs]);

  const doAiAsk = useCallback(async (q: string) => {
    if (!q.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiAnswer("");
    setAiError("");
    setAiSources([]);
    setAiDone(false);

    try {
      const res = await fetch("/api/ai/ask-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setAiError((await res.text()) || "AI 请求失败");
        setAiLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream reader");
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setAiAnswer((prev) => prev + text);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setAiError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setAiLoading(false);
      setAiDone(true);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    doSearch(v);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    doAiAsk(query);
  };

  const navigateItem = useCallback((dir: "up" | "down") => {
    if (results.length === 0) return;
    setSelectedIdx((prev) => {
      let next = dir === "down" ? prev + 1 : prev - 1;
      if (next < 0) next = results.length - 1;
      if (next >= results.length) next = 0;
      if (listRef.current) {
        const el = listRef.current.children[next] as HTMLElement | undefined;
        el?.scrollIntoView({ block: "nearest" });
      }
      return next;
    });
  }, [results]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); navigateItem("down"); }
      if (e.key === "ArrowUp") { e.preventDefault(); navigateItem("up"); }
      if (e.key === "Enter" && selectedIdx >= 0 && results[selectedIdx]) {
        e.preventDefault();
        window.location.href = `/doc?path=${encodeURIComponent(results[selectedIdx].path)}`;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, selectedIdx, navigateItem]);

  return (
    <div className="mx-auto" style={{ maxWidth: 800 }}>
      <div className="mb-4">
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
          🧠 知识库探索
        </h1>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
          {docs.length} 篇文档 · 输入即搜 · Enter 或点 AI 回答 · ↑↓ 导航
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex items-center gap-2 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--family-text-3)", flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索知识库，按 Enter 让 AI 回答…"
            value={query}
            onChange={handleInputChange}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--family-text)" }}
          />
          <button
            type="submit"
            disabled={aiLoading || !query.trim()}
            className="border-0 rounded-xl px-4 py-1.5 text-xs font-semibold family-transition"
            style={{
              background: aiLoading ? "var(--family-text-3)" : "var(--family-primary)",
              color: "#fff",
              cursor: aiLoading || !query.trim() ? "not-allowed" : "pointer",
            }}
          >
            {aiLoading ? "回答中…" : "AI 回答"}
          </button>
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults([]); setAiAnswer(""); setAiDone(false); inputRef.current?.focus(); }}
              className="border-0 bg-transparent p-0 flex items-center"
              style={{ color: "var(--family-text-3)", cursor: "pointer" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {!query.trim() && !aiAnswer && !aiLoading && (
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
            💡 试试搜索
          </h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.query}
                onClick={() => { setQuery(s.query); doSearch(s.query); doAiAsk(s.query); }}
                className="border rounded-full px-3 py-1.5 text-xs family-transition"
                style={{ borderColor: "var(--family-border)", background: "var(--family-surface-2)", color: "var(--family-text-2)", cursor: "pointer" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {aiLoading && (
        <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--family-primary)", background: "var(--family-surface)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: "var(--family-primary)" }} />
            <span className="text-xs" style={{ color: "var(--family-primary)" }}>AI 思考中</span>
          </div>
          <div className="text-sm lh-base" style={{ color: "var(--family-text)", whiteSpace: "pre-wrap" }}>
            {aiAnswer}
            <span className="blink" style={{ animation: "blink 1s step-end infinite" }}>▊</span>
          </div>
          <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
        </div>
      )}

      {aiAnswer && !aiLoading && (
        <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: "1rem" }}>🤖</span>
            <span className="text-xs font-semibold" style={{ color: "var(--family-text-2)" }}>AI 回答</span>
            <button
              onClick={() => doAiAsk(query)}
              className="border-0 bg-transparent text-xs p-0 ms-auto"
              style={{ color: "var(--family-text-3)", cursor: "pointer" }}
            >
              重新回答
            </button>
          </div>
          <div className="text-sm lh-base" style={{ color: "var(--family-text)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {aiAnswer}
          </div>
        </div>
      )}

      {aiError && (
        <div className="rounded-2xl border p-3 text-xs mb-4" style={{ borderColor: "#f5e0df", background: "#fdf6f5", color: "#a04844" }}>
          {aiError}
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <div className="rounded-2xl border p-5 text-center" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
          <p className="text-sm mb-0" style={{ color: "var(--family-text-3)" }}>
            未找到匹配「{query}」的文档
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div ref={listRef} className="flex flex-col gap-2">
          <div className="text-xs mb-1 flex items-center justify-between" style={{ color: "var(--family-text-3)" }}>
            <span>找到 {results.length} 条结果 · ↑↓ 导航 · Enter 打开</span>
          </div>
          {results.map((doc, i) => (
            <Link
              key={doc.id}
              href={`/doc?path=${encodeURIComponent(doc.path)}`}
              className="rounded-2xl border p-4 no-underline family-transition"
              style={{
                borderColor: i === selectedIdx ? "var(--family-primary)" : "var(--family-border)",
                background: i === selectedIdx ? "var(--family-primary-soft)" : "var(--family-surface)",
                color: "var(--family-text)",
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-semibold mb-0 flex items-center gap-2" style={{ color: "var(--family-text)" }}>
                  {highlightText(doc.title, query)}
                  {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--family-primary)", color: "#fff" }}>最佳</span>}
                </h3>
              </div>
              <p className="text-xs mb-2 lh-base" style={{ color: "var(--family-text-2)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {highlightText(doc.text?.slice(0, 500) || doc.excerpt, query)}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs truncate" style={{ color: "var(--family-text-3)", maxWidth: 300 }}>{doc.path}</span>
                {doc.tags.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}>{t}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
