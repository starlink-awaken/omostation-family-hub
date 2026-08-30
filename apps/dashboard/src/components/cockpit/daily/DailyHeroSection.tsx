import type { DailyHeroSummary } from "@/types/daily";

type Props = {
  tags: string[];
  description: string | null;
  summaries: DailyHeroSummary[];
};

export function DailyHeroSection({ tags, description, summaries }: Props) {
  if (!tags.length && !description && !summaries.length) return null;

  return (
    <section className="family-section">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, i) => (
            <span key={i} className="badge bg-surface-2 text-xs">{tag}</span>
          ))}
        </div>
      )}
      {description && (
        <div className="strip-card p-3 mb-3">
          <p className="text-sm text-surface-2 mb-0">{description}</p>
        </div>
      )}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summaries.map((s, i) => (
            <div key={i}>
              <div className="cockpit-card h-full">
                <div className="cockpit-card-body text-center">
                  <div className="text-xs text-surface-2 mb-1">{s.label}</div>
                  <div className="text-lg font-bold">{s.value}</div>
                  <div className="text-xs text-surface-3">{s.subtitle}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
