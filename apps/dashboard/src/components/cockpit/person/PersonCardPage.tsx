import Link from "next/link";
import type { PersonEntry } from "@/lib/person-registry";

type Props = {
  entry: PersonEntry;
  renderedMd: string;
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  warning: { bg: "color-mix(in srgb, var(--family-warning), transparent 88%)", color: "var(--family-warning)" },
  primary: { bg: "var(--family-primary-soft)", color: "var(--family-primary)" },
  info: { bg: "color-mix(in srgb, var(--family-info), transparent 88%)", color: "var(--family-info)" },
  "primary-soft": { bg: "var(--family-primary-soft)", color: "var(--family-primary)" },
  success: { bg: "color-mix(in srgb, var(--family-success), transparent 88%)", color: "var(--family-success)" },
};

export function PersonCardPage({ entry, renderedMd }: Props) {
  const statusStyle = STATUS_STYLES[entry.statusStyle] ?? STATUS_STYLES.primary;

  return (
    <div className="cockpit-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        {/* Hero */}
        <section className="rounded-2xl border p-6 sm:p-8 mb-6" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <span className="mx-auto flex h-20 w-20 flex-none items-center justify-center rounded-full text-2xl font-bold sm:mx-0" style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}>
              {entry.avatarChar}
            </span>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="family-h1">{entry.name}</h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex h-7 items-center rounded-lg px-3 text-xs font-semibold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                  {entry.statusLabel}
                </span>
                <span className="text-xs" style={{ color: "var(--family-text-3)" }}>
                  {entry.tagline}
                </span>
              </div>
              {entry.roleTags.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  {entry.roleTags.map((tag, i) => (
                    <span key={i} className="inline-flex h-6 items-center rounded-md px-2 text-xs" style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Info strip */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--family-text-3)" }}>当前关注</div>
            <div className="mt-1 text-sm" style={{ color: "var(--family-text)" }}>{entry.focus ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--family-text-3)" }}>下步动作</div>
            <div className="mt-1 text-sm" style={{ color: "var(--family-text)" }}>{entry.next ?? "—"}</div>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
            <div className="text-xs font-semibold" style={{ color: "var(--family-text-3)" }}>档案入口</div>
            <div className="mt-1">
              <Link href={`/doc?path=${encodeURIComponent(entry.sourcePath)}`} className="text-sm" style={{ color: "var(--family-primary)" }}>
                {entry.archiveLabel} →
              </Link>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mb-6 text-sm leading-7" style={{ color: "var(--family-text-2)" }}>
          {entry.description}
        </p>

        {/* Related links */}
        {entry.relatedLinks.length > 0 && (
          <section className="mb-6">
            <h2 className="family-h2 mb-4">相关档案</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entry.relatedLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  className="flex flex-col gap-1 rounded-2xl border p-4 family-transition"
                  style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
                >
                  <span className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>{link.label}</span>
                  <span className="text-xs" style={{ color: "var(--family-text-2)" }}>{link.description}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Rendered markdown */}
        {renderedMd && (
          <section className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
            <h2 className="family-h2 mb-4">档案内容</h2>
            <div className="md-body" dangerouslySetInnerHTML={{ __html: renderedMd }} />
          </section>
        )}

        {/* Footer nav */}
        <div className="mt-8 flex items-center gap-3 border-t pt-6" style={{ borderColor: "var(--family-border)" }}>
          <Link
            href="/members"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold family-transition"
            style={{ background: "var(--family-surface)", border: "1px solid var(--family-border)", color: "var(--family-text)" }}
          >
            ← 返回成员总览
          </Link>
        </div>
      </div>
    </div>
  );
}
