import Link from "next/link";
import type { HomeMemberCapsule } from "@/types/home";

type Props = {
  capsules: HomeMemberCapsule[];
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

export function SummaryMemberCapsules({ capsules }: Props) {
  if (!capsules.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">成员胶囊</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {capsules.map((capsule) => {
          const slug = personSlug(capsule.name);

          return (
            <div key={capsule.id}>
              <div className="cockpit-card h-full">
                <div className="cockpit-card-body">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="avatar-sm bg-primary-soft text-primary-emphasis font-bold rounded-full flex items-center justify-center">
                      {capsule.avatarChar}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{capsule.name}</div>
                      <div className="text-xs text-surface-3">{capsule.tagline}</div>
                    </div>
                  </div>
                  <p className="text-xs text-surface-2 mb-2">{capsule.description}</p>
                  {slug ? (
                    <Link
                      href={`/person/${slug}`}
                      className="text-xs text-accent no-underline"
                    >
                      {capsule.archiveLabel} →
                    </Link>
                  ) : (
                    <a
                      href={`/doc?path=${encodeURIComponent(capsule.sourcePath)}`}
                      className="text-xs text-accent no-underline"
                    >
                      {capsule.archiveLabel} →
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
