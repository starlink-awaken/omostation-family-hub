import type { MembersSignalCard } from "@/types/members";

type Props = {
  signalCards: MembersSignalCard[];
};

const barColorMap: Record<string, string> = {
  warning: "bg-warning",
  primary: "bg-primary",
  info: "bg-info",
  "primary-soft": "bg-primary-soft",
  success: "bg-success",
};

export function MembersSignalBand({ signalCards }: Props) {
  if (!signalCards.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">关注强度</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {signalCards.map((card) => (
          <div key={card.id}>
            <div className="cockpit-card h-full">
              <div className="cockpit-card-body">
                <div className="flex items-center gap-2 mb-2">
                  <span className="avatar-sm bg-primary-soft text-primary-emphasis font-bold rounded-full flex items-center justify-center">
                    {card.avatarChar}
                  </span>
                  <div className="min-w-0 grow">
                    <div className="text-sm font-semibold">{card.name}</div>
                    <div className="text-xs text-surface-3">{card.tagline}</div>
                  </div>
                  <span className="text-xs text-surface-3">{card.statusLabel}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="grow bg-surface-1 rounded" style={{ height: 6 }}>
                    <div
                      className={`rounded ${barColorMap[card.barColor] ?? "bg-surface-2"}`}
                      style={{ width: `${card.percentage}%`, height: "100%" }}
                    />
                  </div>
                  <span className="text-xs text-surface-3">{card.intensity}</span>
                </div>
                <p className="text-xs text-surface-2 mb-0">{card.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
