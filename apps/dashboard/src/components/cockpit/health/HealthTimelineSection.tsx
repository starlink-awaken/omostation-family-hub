import Link from "next/link";
import type { HealthTimelineEntry, HealthArchiveEntry, HealthNoteEntry } from "@/types/health";

const ICON_STYLES: Record<string, { bg: string; color: string }> = {
  warning: { bg: "var(--family-warning)", color: "var(--family-surface)" },
  "primary-soft": { bg: "var(--family-primary-soft)", color: "var(--family-primary)" },
  info: { bg: "var(--family-info)", color: "var(--family-surface)" },
  success: { bg: "var(--family-success)", color: "var(--family-surface)" },
  danger: { bg: "var(--family-danger)", color: "var(--family-surface)" },
};

export function HealthTimeline({ entries }: { entries: HealthTimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <article
        className="surface-panel p-5 sm:p-6 xl:col-span-7"
        style={{
          border: "1px solid var(--family-border)",
          borderRadius: "var(--family-radius-lg)",
          background: "var(--family-surface)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="family-h2 text-[22px]">随访节奏</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
              时间线不追求医学流程感，而是帮助家庭知道接下来先做哪件事、再做哪件事。
            </p>
          </div>
          <span
            className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
            style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
          >
            按近到远
          </span>
        </div>
        <div className="mt-5">
          <div
            className="rounded-2xl border p-4 text-sm"
            style={{ borderColor: "var(--family-border)", background: "var(--family-surface)", color: "var(--family-text-2)" }}
          >
            暂无随访节奏数据
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className="surface-panel p-5 sm:p-6 xl:col-span-7"
      style={{
        border: "1px solid var(--family-border)",
        borderRadius: "var(--family-radius-lg)",
        background: "var(--family-surface)",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="family-h2 text-[22px]">随访节奏</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
            时间线不追求医学流程感，而是帮助家庭知道接下来先做哪件事、再做哪件事。
          </p>
        </div>
        <span
          className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
          style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
        >
          按近到远
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {entries.map((entry, index) => {
          const iconStyle = ICON_STYLES[entry.iconStyle] ?? ICON_STYLES["primary-soft"];
          const isLast = index === entries.length - 1;

          return (
            <article
              key={entry.id}
              className="timeline-item flex gap-4 rounded-2xl border p-4 sm:p-5 family-transition"
              style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
            >
              <div className="timeline-marker flex flex-col items-center">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: iconStyle.bg, color: iconStyle.color }}
                >
                  <TimelineIcon icon={entry.icon} />
                </span>
                {!isLast ? (
                  <span className="mt-2 h-full w-px flex-1" style={{ background: "var(--family-border)" }} />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="family-h3 truncate text-[18px]">{entry.title}</h3>
                  {entry.tags.map((tag) => {
                    const tagStyle = ICON_STYLES[entry.iconStyle] ?? ICON_STYLES["primary-soft"];
                    return (
                      <span
                        key={tag}
                        className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
                        style={{ background: tagStyle.bg, color: tagStyle.color }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--family-text-2)" }}>
                  {entry.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </article>
  );
}

export function HealthArchives({ entries }: { entries: HealthArchiveEntry[] }) {
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
          <h2 className="family-h2 text-[22px]">档案入口</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
            从总览进入具体档案，避免健康信息散在不同地方。
          </p>
        </div>
        <FolderHeartIcon />
      </div>

      {entries.length > 0 ? (
        <div className="mt-5 space-y-3">
          {entries.map((entry) => (
            <Link
              key={`${entry.title}-${entry.href}`}
              href={entry.href}
              className="archive-row flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 family-transition"
              style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                  {entry.title}
                </span>
                {entry.description ? (
                  <span className="mt-1 block truncate text-xs" style={{ color: "var(--family-text-2)" }}>
                    {entry.description}
                  </span>
                ) : null}
              </span>
              <ArrowRightIcon />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <div
            className="rounded-2xl border p-4 text-sm"
            style={{ borderColor: "var(--family-border)", background: "var(--family-surface)", color: "var(--family-text-2)" }}
          >
            暂无档案入口数据
          </div>
        </div>
      )}
    </article>
  );
}

export function HealthNotes({ notes }: { notes: HealthNoteEntry[] }) {
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
          <h2 className="family-h2 text-[22px]">近期备注</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
            保留一点日常语气，让页面更像家里正在使用的系统。
          </p>
        </div>
        <span
          className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
          style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}
        >
          近三条
        </span>
      </div>

      {notes.length > 0 ? (
        <div className="mt-5 space-y-3">
          {notes.slice(0, 3).map((note, index) => (
            <div
              key={`note-${index}`}
              className="note-row rounded-2xl border p-4"
              style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                {note.date}
              </p>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--family-text-2)" }}>
                {note.description}
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
            暂无近期备注数据
          </div>
        </div>
      )}
    </article>
  );
}

function TimelineIcon({ icon }: { icon: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icon === "eye" ? (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : icon === "moon-star" ? (
        <>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          <path d="M19 3v4" />
          <path d="M21 5h-4" />
        </>
      ) : icon === "calendar-range" ? (
        <>
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
          <path d="M8 2v4" />
        </>
      ) : (
        <>
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          <path d="M12 10v6" />
          <path d="M9 13h6" />
        </>
      )}
    </svg>
  );
}

function FolderHeartIcon() {
  return (
    <svg className="h-5 w-5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--family-text-3)" }}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M8 10s2 1.5 4 3.5c2-2 4-3.5 4-3.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="btn-arrow h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
