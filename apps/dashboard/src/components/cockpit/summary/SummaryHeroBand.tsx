import type { HomeHeroCard } from "@/types/home";

type Props = {
  cards: HomeHeroCard[];
};

export function SummaryHeroBand({ cards }: Props) {
  if (!cards.length) return null;

  return (
    <section className="family-section">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, i) => (
          <div key={i}>
            <div className="cockpit-card h-full">
              <div className="cockpit-card-body text-center">
                <div className="text-xs text-surface-2 mb-1">{card.label}</div>
                <div className="text-xl font-bold">{card.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
