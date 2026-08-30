import type { MembersSignalItem } from "@/types/members";

type Props = {
  signals: MembersSignalItem[];
};

const iconClassMap: Record<string, string> = {
  warning: "text-warning-emphasis",
  info: "text-info-emphasis",
  "primary-soft": "text-primary-emphasis",
  success: "text-success-emphasis",
};

export function MembersSideSignals({ signals }: Props) {
  if (!signals.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">关注信号</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body">
          <div className="flex flex-col gap-2">
            {signals.map((sig) => (
              <div key={sig.id} className="flex items-start gap-2 p-2 bg-surface-1 rounded-lg">
                <span className={`icon-md shrink-0 ${iconClassMap[sig.iconStyle] ?? "text-surface-3"}`}>
                  <i className={`bi bi-${sig.icon}`}></i>
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium">{sig.title}</div>
                  <div className="text-xs text-surface-3">{sig.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
