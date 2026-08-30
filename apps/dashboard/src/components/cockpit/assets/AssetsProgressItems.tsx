type Props = {
  items: Array<{
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
  "surface-2": "badge bg-surface-2 text-surface-3",
};

export function AssetsProgressItems({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">当前推进</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body p-0">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 border-b border-surface-1 last:border-0"
            >
              <span className="icon-md text-surface-3 shrink-0">
                <i className={`bi bi-${item.icon}`}></i>
              </span>
              <div className="min-w-0 grow">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-medium">{item.title}</div>
                  <span className={badgeClassMap[item.badgeStyle] ?? "badge bg-surface-2 text-xs"}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-xs text-surface-2 mb-0">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
