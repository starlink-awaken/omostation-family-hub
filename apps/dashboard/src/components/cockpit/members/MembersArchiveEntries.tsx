type Props = {
  archives: Array<{ title: string; description: string; href: string }>;
};

export function MembersArchiveEntries({ archives }: Props) {
  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">档案入口</h2>
      {archives.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {archives.map((archive, i) => (
            <div key={i}>
              <a
                href={archive.href}
                className="cockpit-card block h-full no-underline"
              >
                <div className="cockpit-card-body">
                  <h3 className="text-sm font-semibold mb-1">{archive.title}</h3>
                  <p className="text-xs text-surface-2 mb-0">{archive.description}</p>
                </div>
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="cockpit-card">
          <div className="cockpit-card-body">
            <p className="text-xs text-surface-2 mb-0">暂无档案入口，可通过 data-manifest 配置</p>
          </div>
        </div>
      )}
    </section>
  );
}
