import type { HealthSignalItem, HealthStableItem } from "@/types/health";

const ICON_STYLES: Record<string, { bg: string; color: string }> = {
  warning: { bg: "var(--family-warning)", color: "var(--family-surface)" },
  "primary-soft": { bg: "var(--family-primary-soft)", color: "var(--family-primary)" },
  info: { bg: "var(--family-info)", color: "var(--family-surface)" },
  success: { bg: "var(--family-success)", color: "var(--family-surface)" },
  danger: { bg: "var(--family-danger)", color: "var(--family-surface)" },
};

export function HealthFollowUpSignals({ signals }: { signals: HealthSignalItem[] }) {
  return (
    <article
      className="surface-panel p-5 sm:p-6"
      style={{
        border: "1px solid var(--family-border)",
        borderRadius: "var(--family-radius-lg)",
        background: "var(--family-surface)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="family-h2 text-[22px]">随访信号</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
            把近期健康关注拆成可执行的小信号，减少遗忘。
          </p>
        </div>
        <SignalStethoscopeIcon />
      </div>

      {signals.length > 0 ? (
        <div className="mt-5 space-y-3">
          {signals.map((signal) => {
            const iconStyle = ICON_STYLES[signal.iconStyle] ?? ICON_STYLES["primary-soft"];
            return (
              <article
                key={signal.id}
                className="signal-item flex items-start gap-3 rounded-2xl border p-4 family-transition"
                style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
              >
                <span
                  className="signal-icon inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl"
                  style={{ background: iconStyle.bg, color: iconStyle.color }}
                >
                  <SignalIcon icon={signal.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                      {signal.title}
                    </p>
                    <span
                      className="inline-flex h-6 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold"
                      style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
                    >
                      {signal.timeBadge}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6" style={{ color: "var(--family-text-2)" }}>
                    {signal.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5">
          <div
            className="rounded-2xl border p-4 text-sm"
            style={{ borderColor: "var(--family-border)", background: "var(--family-surface)", color: "var(--family-text-2)" }}
          >
            暂无随访信号数据
          </div>
        </div>
      )}
    </article>
  );
}

export function HealthStableItems({ items }: { items: HealthStableItem[] }) {
  return (
    <article
      className="surface-panel p-5 sm:p-6"
      style={{
        border: "1px solid var(--family-border)",
        borderRadius: "var(--family-radius-lg)",
        background: "var(--family-surface)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="family-h2 text-[22px]">已稳事项</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
            保留稳定感，提醒家里并不是所有项目都处于紧张状态。
          </p>
        </div>
        <BadgeCheckIcon />
      </div>

      {items.length > 0 ? (
        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <div
              key={`stable-${index}`}
              className="done-row rounded-2xl border p-4"
              style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                {item.title}
              </p>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--family-text-2)" }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <div
            className="rounded-2xl border p-4 text-sm"
            style={{ borderColor: "var(--family-border)", background: "var(--family-surface)", color: "var(--family-text-2)" }}
          >
            暂无已稳定项数据
          </div>
        </div>
      )}
    </article>
  );
}

function SignalIcon({ icon }: { icon: string }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icon === "eye" ? (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : icon === "utensils-crossed" ? (
        <>
          <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
          <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
          <path d="m2.1 21.8 6.4-6.3" />
          <path d="m19 5-7 7" />
        </>
      ) : icon === "moon-star" ? (
        <>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          <path d="M19 3v4" />
          <path d="M21 5h-4" />
        </>
      ) : icon === "flask-conical" ? (
        <>
          <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
          <path d="M8.5 2h7" />
          <path d="M7 16h10" />
        </>
      ) : (
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      )}
    </svg>
  );
}

function SignalStethoscopeIcon() {
  return (
    <svg className="h-5 w-5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--family-text-3)" }}>
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.3.3 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function BadgeCheckIcon() {
  return (
    <svg className="h-5 w-5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--family-text-3)" }}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
