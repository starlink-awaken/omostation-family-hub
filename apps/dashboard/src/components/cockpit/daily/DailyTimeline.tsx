import type { DailyTimelineEntry } from "@/types/daily";

type Props = {
  timeline: DailyTimelineEntry[];
};

const iconClassMap: Record<string, string> = {
  warning: "bg-warning-subtle text-warning-emphasis",
  "primary-soft": "bg-primary-soft text-primary-emphasis",
  info: "bg-info-subtle text-info-emphasis",
  success: "bg-success-subtle text-success-emphasis",
};

const badgeClassMap: Record<string, string> = {
  warning: "badge bg-warning-subtle text-warning-emphasis",
  "primary-soft": "badge bg-primary-soft text-primary-emphasis",
  info: "badge bg-info-subtle text-info-emphasis",
  success: "badge bg-success-subtle text-success-emphasis",
};

export function DailyTimeline({ timeline }: Props) {
  if (!timeline.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">本周节奏</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body p-0">
          {timeline.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 border-b border-surface-1 last:border-0"
            >
              <span className={`icon-md shrink-0 p-2 rounded-lg ${iconClassMap[entry.iconStyle] ?? "bg-surface-2"}`}>
                <i className={`bi bi-${entry.icon}`}></i>
              </span>
              <div className="min-w-0 grow">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-medium">{entry.title}</div>
                  <span className={badgeClassMap[entry.badgeStyle] ?? "badge bg-surface-2 text-xs"}>
                    {entry.badge}
                  </span>
                </div>
                <p className="text-xs text-surface-2 mb-0">{entry.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
