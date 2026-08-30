"use client";

import Link from "next/link";

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center min-vh-100 px-4 text-center"
      style={{ background: "var(--family-bg)" }}
    >
      <div className="mb-4" style={{ fontSize: "3.5rem", lineHeight: 1 }}>
        ⚠️
      </div>
      <h1 className="font-bold mb-2" style={{ color: "var(--family-text)", fontSize: "1.25rem" }}>
        出了点问题
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--family-text-2)", maxWidth: 360 }}>
        页面加载时发生了错误。可能是数据文件损坏或临时异常。
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold border-0 family-transition"
          style={{ background: "var(--family-primary)", color: "#fff", cursor: "pointer" }}
        >
          重试
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold no-underline family-transition"
          style={{ background: "var(--family-surface)", color: "var(--family-text-2)", border: "1px solid var(--family-border)" }}
        >
          ← 返回首页
        </Link>
      </div>
      {_error.digest && (
        <p className="mt-4 text-xs" style={{ color: "var(--family-text-3)" }}>
          错误 ID: {_error.digest}
        </p>
      )}
    </div>
  );
}
