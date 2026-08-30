import type { GrowthOverviewStrip as GrowthOverviewStripType } from "@/types/growth";

type Props = {
  strip: GrowthOverviewStripType | null;
};

export function GrowthOverviewStrip({ strip }: Props) {
  if (!strip) return null;

  return (
    <section className="family-section">
      <div className="strip-card p-3 mb-3">
        {strip.summary && (
          <p className="text-sm text-surface-2 mb-3">{strip.summary}</p>
        )}
        {strip.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {strip.tags.map((tag, i) => (
              <span key={i} className="badge bg-primary-soft text-xs">{tag}</span>
            ))}
          </div>
        )}
        {strip.meterSteps.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {strip.meterSteps.map((step, i) => (
              <div
                key={i}
                className={`grow p-2 rounded-lg text-xs text-center ${
                  step.active ? "bg-primary-soft font-semibold" : "bg-surface-1 text-surface-3"
                }`}
              >
                <div>{step.label}</div>
                <div className="text-xs opacity-75">{step.description}</div>
              </div>
            ))}
          </div>
        )}
        {strip.miniCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {strip.miniCards.map((card, i) => (
              <div key={i}>
                <div className="p-2 bg-surface-1 rounded-lg text-center">
                  <div className="text-xs text-surface-3">{card.label}</div>
                  <div className="text-sm font-semibold">{card.value}</div>
                  <div className="text-xs text-surface-3">{card.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
