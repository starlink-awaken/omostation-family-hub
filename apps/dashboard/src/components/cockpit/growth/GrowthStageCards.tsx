import type { GrowthStageCard } from "@/types/growth";

type Props = {
  cards: GrowthStageCard[];
};

const badgeClassMap: Record<string, string> = {
  warning: "badge bg-warning-subtle text-warning-emphasis",
  "primary-soft": "badge bg-primary-soft text-primary-emphasis",
  info: "badge bg-info-subtle text-info-emphasis",
  success: "badge bg-success-subtle text-success-emphasis",
};

export function GrowthStageCards({ cards }: Props) {
  if (!cards.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">阶段看板</h2>
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
                    <div className="text-xs text-surface-3 mb-1">{card.subtitle}</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {card.tags.map((tag, i) => (
                        <span key={i} className="badge bg-surface-1 text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-surface-2 mb-2">{card.description}</p>
                <div className="text-xs text-surface-3">
                  <span className="font-medium">下步：</span>{card.nextStep}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
