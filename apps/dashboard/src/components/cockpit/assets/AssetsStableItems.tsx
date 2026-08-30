type Props = {
  items: Array<{ title: string; description: string }>;
};

export function AssetsStableItems({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">已稳固项</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map((item, i) => (
              <div key={i}>
                <div className="flex items-start gap-2 p-2 bg-surface-1 rounded-lg">
                  <span className="text-success-emphasis shrink-0">
                    <i className="bi bi-check-circle-fill"></i>
                  </span>
                  <div>
                    <div className="text-xs font-medium">{item.title}</div>
                    <div className="text-xs text-surface-3">{item.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
