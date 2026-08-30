import type { GrowthSignalItem } from "@/types/growth";

type Props = {
  signals: GrowthSignalItem[];
};

const iconClassMap: Record<string, string> = {
  warning: "text-warning-emphasis",
  "primary-soft": "text-primary-emphasis",
  info: "text-info-emphasis",
  success: "text-success-emphasis",
};

export function GrowthSignals({ signals }: Props) {
  if (!signals.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">成长信号</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body p-0">
          {signals.map((sig) => (
            <div
              key={sig.id}
              className="flex items-start gap-3 p-3 border-b border-surface-1 last:border-0"
            >
              <span className={`icon-md shrink-0 ${iconClassMap[sig.iconStyle] ?? "text-surface-3"}`}>
                <i className={`bi bi-${sig.icon}`}></i>
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium mb-1">{sig.title}</div>
                <div className="text-xs text-surface-2">{sig.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
