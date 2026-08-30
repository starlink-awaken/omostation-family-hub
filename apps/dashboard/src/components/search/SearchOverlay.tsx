"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scoreDoc, highlightText } from "@/lib/search";
import type { SearchDoc } from "@/lib/search";

export function SearchOverlay({ initialDocs }: { initialDocs: SearchDoc[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(SearchDoc & { score?: number })[]>([]);
  const [docs] = useState<SearchDoc[]>(initialDocs);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const doServerSearch = useCallback(async (q: string) => {
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 20 }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.results?.length) {
        setResults(data.results);
        setLoading(false);
        return true;
      }
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIdx(-1);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const ok = await doServerSearch(query);
      if (!ok) {
        const scored = docs
          .map((doc) => ({ doc, score: scoreDoc(doc, query) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
          .map((r) => r.doc);
        setResults(scored);
      }
      setLoading(false);
      setSelectedIdx(-1);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, docs, doServerSearch]);

  const navigateItem = useCallback(
    (dir: "up" | "down") => {
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
    },
    [results]
  );

  const handleSelect = useCallback((path: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    window.location.href = `/doc?path=${encodeURIComponent(path)}`;
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); navigateItem("down"); }
      if (e.key === "ArrowUp") { e.preventDefault(); navigateItem("up"); }
      if (e.key === "Enter" && selectedIdx >= 0 && results[selectedIdx]) {
        e.preventDefault();
        handleSelect(results[selectedIdx].path);
      }
    }
    function onCustom() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("family:open-search", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("family:open-search", onCustom);
    };
  }, [open, selectedIdx, results, navigateItem, handleSelect]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={() => { setOpen(false); setQuery(""); }}
    >
      <div
        className="w-full max-w-[600px] rounded-2xl border shadow-2xl"
        style={{ background: "var(--family-surface)", borderColor: "var(--family-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--family-border)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--family-text-3)", flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索知识库… 按 ↑↓ 导航 · Enter 打开"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--family-text)" }}
          />
          {loading && (
            <span className="text-xs shrink-0" style={{ color: "var(--family-text-3)" }}>搜索中…</span>
          )}
          <kbd className="hidden rounded-md border px-1.5 py-0.5 text-xs shrink-0 sm:inline-block" style={{ borderColor: "var(--family-border)", color: "var(--family-text-3)" }}>
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {query && results.length === 0 && !loading && (
            <p className="px-2 py-6 text-center text-sm" style={{ color: "var(--family-text-3)" }}>
              没有匹配结果
            </p>
          )}
          {results.length === 0 && !query && !loading && (
            <p className="px-2 py-6 text-center text-xs" style={{ color: "var(--family-text-3)" }}>
              输入关键词搜索知识库
            </p>
          )}
          {results.map((doc, i) => (
            <button
              key={doc.id}
              onClick={() => handleSelect(doc.path)}
              onMouseEnter={() => setSelectedIdx(i)}
              className="w-full rounded-xl px-3 py-2.5 text-left family-transition"
              style={{ background: i === selectedIdx ? "var(--family-surface-2)" : "transparent" }}
            >
              <div className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--family-text)" }}>
                {highlightText(doc.title, query)}
                {i === 0 && results.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}>
                    最佳匹配
                  </span>
                )}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--family-text-2)" }}>
                {highlightText(doc.excerpt || doc.text, query)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="truncate text-[11px]" style={{ color: "var(--family-text-3)" }}>
                  {doc.path}
                </span>
                {doc.tags && doc.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
          {results.length > 0 && (
            <div className="px-3 py-2 text-[10px] text-center" style={{ color: "var(--family-text-3)" }}>
              ↑↓ 导航 · Enter 打开 · Esc 关闭
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
