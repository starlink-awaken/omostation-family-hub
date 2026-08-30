import type { HomeHeroCard } from "@/types/home";

type Props = {
  summary: string | null;
  badge: string | null;
  cards: HomeHeroCard[];
};

export function SummaryCurrentState({ summary, badge, cards }: Props) {
  if (!summary && !badge && !cards.length) return null;

  return (
    <section className="family-section">
      <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-3">
        <div>
          <div className="cockpit-card h-full">
            <div className="cockpit-card-body">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold mb-0">当前判断</h3>
                {badge && (
                  <span className="badge bg-warning-subtle text-warning-emphasis text-xs">{badge}</span>
                )}
              </div>
              {summary && (
                <p className="text-sm text-surface-2 mb-0">{summary}</p>
              )}
            </div>
          </div>
        </div>
        {cards.map((card, i) => (
          <div key={i}>
            <div className="cockpit-card h-full">
              <div className="cockpit-card-body text-center">
                <div className="text-xs text-surface-2 mb-1">{card.label}</div>
                <div className="text-base font-bold">{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
