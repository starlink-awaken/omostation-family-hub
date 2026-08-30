type Props = {
  entries: Array<{
    icon: string;
    title: string;
    description: string;
    href: string;
  }>;
};

export function GrowthPlanEntries({ entries }: Props) {
  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">计划入口</h2>
      {entries.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {entries.map((entry, i) => (
            <div key={i}>
              <a
                href={entry.href}
                className="cockpit-card block h-full no-underline"
              >
                <div className="cockpit-card-body">
                  <span className="icon-md text-surface-3 mb-2 block">
                    <i className={`bi bi-${entry.icon}`}></i>
                  </span>
                  <h3 className="text-sm font-semibold mb-1">{entry.title}</h3>
                  <p className="text-xs text-surface-2 mb-0">{entry.description}</p>
                </div>
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="cockpit-card">
          <div className="cockpit-card-body">
            <p className="text-xs text-surface-2 mb-0">暂无计划入口，可通过 data-manifest 配置</p>
          </div>
        </div>
      )}
    </section>
  );
}
