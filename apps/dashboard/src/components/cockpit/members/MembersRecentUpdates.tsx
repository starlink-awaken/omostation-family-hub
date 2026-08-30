type Props = {
  updates: Array<{ timeLabel: string; description: string }>;
};

export function MembersRecentUpdates({ updates }: Props) {
  if (!updates.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">最近更新</h2>
      <div className="cockpit-card">
        <div className="cockpit-card-body p-0">
          {updates.map((update, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 border-b border-surface-1 last:border-0"
            >
              <div className="grow min-w-0">
                <div className="text-xs text-surface-2">{update.description}</div>
              </div>
              <span className="badge bg-surface-2 text-xs shrink-0">
                {update.timeLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
