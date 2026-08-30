type Props = {
  timeline: Array<{
    id: string;
    icon: string;
    title: string;
    badge: string;
    badgeStyle: string;
    description: string;
  }>;
};

const badgeClassMap: Record<string, string> = {
  warning: "badge bg-warning-subtle text-warning-emphasis",
  info: "badge bg-info-subtle text-info-emphasis",
  "primary-soft": "badge bg-primary-soft text-primary-emphasis",
  success: "badge bg-success-subtle text-success-emphasis",
};

export function AssetsTimeline({ timeline }: Props) {
  if (!timeline.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">推进时序</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body p-0">
          {timeline.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 border-b border-surface-1 last:border-0"
            >
              <span className="icon-md text-surface-3 shrink-0">
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
