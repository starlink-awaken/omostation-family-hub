import type { DailyOverviewMiniCard } from "@/types/daily";

type Props = {
  summary: string | null;
  tags: string[];
  heatSteps: Array<{ label: string; description: string; active: boolean }>;
  miniCards: DailyOverviewMiniCard[];
};

export function DailyOverviewStrip({ summary, tags, heatSteps, miniCards }: Props) {
  if (!summary && !tags.length && !heatSteps.length && !miniCards.length) return null;

  return (
    <section className="family-section">
      <div className="strip-card p-3">
        {summary && (
          <p className="text-sm text-surface-2 mb-3">{summary}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag, i) => (
              <span key={i} className="badge bg-primary-soft text-xs">{tag}</span>
            ))}
          </div>
        )}
        {heatSteps.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {heatSteps.map((step, i) => (
              <div
                key={i}
                className={`grow p-2 rounded-lg text-xs text-center ${
                  step.active ? "bg-warning-subtle font-semibold" : "bg-surface-1 text-surface-3"
                }`}
              >
                <div>{step.label}</div>
                <div className="text-xs opacity-75">{step.description}</div>
              </div>
            ))}
          </div>
        )}
        {miniCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {miniCards.map((card, i) => (
              <div key={i}>
                <div className="p-2 bg-surface-1 rounded-lg">
                  <div className="text-xs text-surface-3">{card.label}</div>
                  <div className="text-sm font-semibold">{card.value}</div>
                  <div className="text-xs text-surface-3">{card.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
