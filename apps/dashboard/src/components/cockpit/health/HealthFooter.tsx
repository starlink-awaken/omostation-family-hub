import type { HealthFooter } from "@/types/health";

export function HealthFooterSection({ footer }: { footer: HealthFooter | null }) {
  if (!footer) {
    return (
      <section className="mt-8 text-center">
        <div
          className="rounded-2xl border p-5"
          style={{
            borderColor: "var(--family-border)",
            background: "var(--family-surface)",
            boxShadow: "var(--family-shadow-soft)",
          }}
        >
          <p
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--family-text-2)" }}
          >
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ background: "var(--family-primary)" }}
            />
            医疗健康总览
          </p>
          <p className="mt-3 text-sm" style={{ color: "var(--family-text-3)" }}>
            健康信息随 SSOT 数据持续更新 · 自动构建
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 text-center">
      <div
        className="rounded-2xl border p-5"
        style={{
          borderColor: "var(--family-border)",
          background: "var(--family-surface)",
          boxShadow: "var(--family-shadow-soft)",
        }}
      >
        <p
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--family-text-2)" }}
        >
          <span
            className="inline-flex h-2 w-2 rounded-full"
            style={{ background: "var(--family-primary)" }}
          />
          {footer.title}
        </p>
        <p className="mt-3 text-sm" style={{ color: "var(--family-text-3)" }}>
          {footer.description}
        </p>
        {footer.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {footer.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium"
                style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
