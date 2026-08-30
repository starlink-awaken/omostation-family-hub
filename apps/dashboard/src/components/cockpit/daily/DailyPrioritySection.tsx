import type { DailyPriorityItem } from "@/types/daily";

type Props = {
  items: DailyPriorityItem[];
};

export function DailyPrioritySection({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">优先顺序</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body p-0">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 border-b border-surface-1 last:border-0"
            >
              <span className={`shrink-0 flex items-center justify-center rounded-full font-bold text-xs ${
                item.isPrimary
                  ? "bg-warning-subtle text-warning-emphasis"
                  : "bg-surface-2 text-surface-3"
              }`} style={{ width: 24, height: 24 }}>
                {item.index}
              </span>
              <div className="min-w-0 grow">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-medium">{item.title}</div>
                  {item.isPrimary && (
                    <span className="badge bg-warning-subtle text-warning-emphasis text-xs">优先</span>
                  )}
                </div>
                <p className="text-xs text-surface-2 mb-0">{item.description}</p>
              </div>
              <span className="text-xs text-surface-3 shrink-0">{item.timeLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
