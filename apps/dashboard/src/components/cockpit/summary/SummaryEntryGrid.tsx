import type { HomeKnowledgeEntry } from "@/types/home";

type Props = {
  entries: HomeKnowledgeEntry[];
};

export function SummaryEntryGrid({ entries }: Props) {
  if (!entries.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">知识入口</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((entry, i) => (
          <div key={i}>
            <a
              href={entry.href}
              className="cockpit-card block h-full no-underline"
            >
              <div className="cockpit-card-body">
                <div className="flex items-center gap-2 mb-2">
                  <span className="icon-md text-surface-3">
                    <i className={`bi bi-${entry.icon}`}></i>
                  </span>
                  <h3 className="text-sm font-semibold mb-0">{entry.title}</h3>
                </div>
                <p className="text-xs text-surface-2 mb-0">{entry.description}</p>
              </div>
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
