"use client";

import Link from "next/link";

export default function AppError({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4" style={{ fontSize: "3rem", lineHeight: 1 }}>📛</div>
      <h2 className="font-bold mb-2" style={{ color: "var(--family-text)", fontSize: "1.1rem" }}>
        页面异常
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--family-text-2)", maxWidth: 320 }}>
        该区域加载失败，其他页面不受影响。
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className="rounded-xl px-4 py-2 text-sm font-semibold border-0 family-transition"
          style={{ background: "var(--family-primary)", color: "#fff", cursor: "pointer" }}
        >
          重试
        </button>
        <Link
          href="/"
          className="rounded-xl px-4 py-2 text-sm font-semibold no-underline family-transition"
          style={{ background: "var(--family-surface)", color: "var(--family-text-2)", border: "1px solid var(--family-border)" }}
        >
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}
