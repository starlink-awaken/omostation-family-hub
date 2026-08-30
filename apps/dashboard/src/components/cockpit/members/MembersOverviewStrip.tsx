import type { MembersOverviewCard, MembersFocusStrip } from "@/types/members";

type Props = {
  cards: MembersOverviewCard[];
  focusStrip: MembersFocusStrip | null;
};

export function MembersOverviewStrip({ cards, focusStrip }: Props) {
  if (!cards.length && !focusStrip) return null;

  return (
    <section className="family-section">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <div key={i}>
            <div className="cockpit-card h-full">
              <div className="cockpit-card-body text-center">
                <div className="text-xs text-surface-2 mb-1">{card.label}</div>
                <div className="text-lg font-bold">{card.value}</div>
                <div className="text-xs text-surface-3">{card.subtitle}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {focusStrip && (
        <div className="strip-card p-3 mt-3">
          <p className="text-sm text-surface-2 mb-0">{focusStrip.primaryDesc}</p>
        </div>
      )}
    </section>
  );
}
