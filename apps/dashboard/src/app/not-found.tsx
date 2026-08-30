import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-vh-100 px-4 text-center"
      style={{ background: "var(--family-bg)" }}
    >
      <div className="mb-4" style={{ fontSize: "3.5rem", lineHeight: 1 }}>
        🔍
      </div>
      <h1 className="font-bold mb-2" style={{ color: "var(--family-text)", fontSize: "1.25rem" }}>
        页面不存在
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--family-text-2)", maxWidth: 360 }}>
        你访问的页面可能已被移动、重命名或删除。试试从首页重新开始。
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold no-underline family-transition"
          style={{ background: "var(--family-primary)", color: "#fff" }}
        >
          ← 返回首页
        </Link>
        <Link
          href="/files"
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold no-underline family-transition"
          style={{ background: "var(--family-surface)", color: "var(--family-text-2)", border: "1px solid var(--family-border)" }}
        >
          浏览知识库
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 justify-center" style={{ maxWidth: 400 }}>
        {[
          { label: "家庭成员", href: "/members" },
          { label: "医疗健康", href: "/health" },
          { label: "育儿成长", href: "/growth" },
          { label: "家庭日常", href: "/daily" },
          { label: "资产设备", href: "/assets" },
          { label: "日历", href: "/calendar" },
          { label: "账目", href: "/finance" },
          { label: "标签", href: "/tags" },
        ].map((nav) => (
          <Link
            key={nav.href}
            href={nav.href}
            className="text-xs no-underline px-2.5 py-1 rounded-lg family-transition"
            style={{ color: "var(--family-text-3)", border: "1px solid var(--family-border)" }}
          >
            {nav.label}
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--family-text-3)" }}>
        家庭驾驶舱 · 家庭生活知识系统
      </p>
    </div>
  );
}
