import type { HomeStateStripCard } from "@/types/home";

type Props = {
  summary: string | null;
  cards: HomeStateStripCard[];
};

export function SummaryStateStrip({ summary, cards }: Props) {
  if (!summary && !cards.length) return null;

  return (
    <section className="family-section">
      <div className="strip-card p-3">
        {summary && (
          <p className="text-sm text-surface-2 mb-3">{summary}</p>
        )}
        {cards.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {cards.map((card, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-surface-3">{card.label}</span>
                <span className="badge bg-primary-soft text-xs">{card.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
