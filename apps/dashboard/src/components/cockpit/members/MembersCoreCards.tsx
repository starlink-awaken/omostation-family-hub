import Link from "next/link";
import type { MembersCoreCard } from "@/types/members";

type Props = {
  cards: MembersCoreCard[];
};

const statusClassMap: Record<string, string> = {
  warning: "badge bg-warning-subtle text-warning-emphasis",
  primary: "badge bg-primary-subtle text-primary-emphasis",
  info: "badge bg-info-subtle text-info-emphasis",
  "primary-soft": "badge bg-primary-soft text-primary-emphasis",
  success: "badge bg-success-subtle text-success-emphasis",
};

function personSlug(name: string): string | null {
  const map: Record<string, string> = {
    "Synthetic Member 01": "xiamingxing",
    "Synthetic Member 06": "qinzhangyao",
    "Synthetic Member 02": "xiaoweizhen",
    "Synthetic Member 04": "xiaobai",
    "Synthetic Member 05": "diandian",
  };
  return map[name] ?? null;
}

export function MembersCoreCards({ cards }: Props) {
  if (!cards.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">核心成员</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {cards.map((card) => {
          const slug = personSlug(card.name);

          return (
            <div key={card.id}>
              <div className="cockpit-card h-full">
                <div className="cockpit-card-body">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="avatar-md bg-primary-soft text-primary-emphasis font-bold rounded-full flex items-center justify-center shrink-0">
                      {card.avatarChar}
                    </span>
                    <div className="min-w-0 grow">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold mb-0">{card.name}</h3>
                        <span className={statusClassMap[card.statusStyle] ?? "badge bg-surface-2"}>
                          {card.statusLabel}
                        </span>
                      </div>
                      <div className="text-xs text-surface-3 mb-1">{card.tagline}</div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {card.roleTags.map((tag, i) => (
                          <span key={i} className="badge bg-surface-1 text-xs">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-surface-2 mb-2">{card.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-surface-3 mb-2">
                    <span>关注：{card.focus}</span>
                    <span>下步：{card.next}</span>
                  </div>
                  {slug ? (
                    <Link
                      href={`/person/${slug}`}
                      className="text-xs text-accent no-underline"
                    >
                      {card.archiveLabel} →
                    </Link>
                  ) : (
                    <a
                      href={`/doc?path=${encodeURIComponent(card.sourcePath)}`}
                      className="text-xs text-accent no-underline"
                    >
                      {card.archiveLabel} →
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
