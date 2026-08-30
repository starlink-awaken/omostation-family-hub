import type { AssetsCoreCard } from "@/types/assets";

type Props = {
  cards: AssetsCoreCard[];
};

const badgeClassMap: Record<string, string> = {
  info: "badge bg-info-subtle text-info-emphasis",
  warning: "badge bg-warning-subtle text-warning-emphasis",
  success: "badge bg-success-subtle text-success-emphasis",
  "primary-soft": "badge bg-primary-soft text-primary-emphasis",
};

export function AssetsCoreCards({ cards }: Props) {
  if (!cards.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">核心资产</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.id}>
            <div className="cockpit-card h-full">
              <div className="cockpit-card-body">
                <div className="flex items-start gap-3 mb-3">
                  <span className="icon-lg text-surface-3 shrink-0">
                    <i className={`bi bi-${card.icon}`}></i>
                  </span>
                  <div className="min-w-0 grow">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold mb-0">{card.title}</h3>
                      <span className={badgeClassMap[card.badgeStyle] ?? "badge bg-surface-2"}>
                        {card.badge}
                      </span>
                    </div>
                    <div className="text-xs text-surface-3 mb-2">{card.subtitle}</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {card.tags.map((tag, i) => (
                        <span key={i} className="badge bg-surface-1 text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="bg-surface-1 rounded-lg p-2">
                      <div className="text-xs text-surface-3">{card.blockLabel}</div>
                      <div className="text-xs font-semibold">{card.blockValue}</div>
                    </div>
                  </div>
                  <div>
                    <div className="bg-surface-1 rounded-lg p-2">
                      <div className="text-xs text-surface-3">{card.stableLabel}</div>
                      <div className="text-xs font-semibold">{card.stableValue}</div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-surface-2 mb-2">{card.description}</p>
                <a
                  href={`/doc?path=${encodeURIComponent(card.sourcePath)}`}
                  className="text-xs text-accent no-underline"
                >
                  {card.archiveLabel} →
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
