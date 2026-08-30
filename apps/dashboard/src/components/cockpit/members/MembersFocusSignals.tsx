type Props = {
  signalItems: Array<{
    id: string;
    icon: string;
    iconStyle: string;
    title: string;
    description: string;
  }>;
};

const iconClassMap: Record<string, string> = {
  warning: "text-warning-emphasis",
  info: "text-info-emphasis",
  "primary-soft": "text-primary-emphasis",
  success: "text-success-emphasis",
};

export function MembersFocusSignals({ signalItems }: Props) {
  if (!signalItems.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">关注信号</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body p-0">
          {signalItems.map((sig) => (
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
