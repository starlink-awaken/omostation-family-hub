import type { HomeKeyMatter } from "@/types/home";

type Props = {
  keyMatters: HomeKeyMatter[];
  decisionRecords: { title: string; description: string }[];
};

const badgeClassMap: Record<string, string> = {
  warning: "badge bg-warning-subtle text-warning-emphasis",
  info: "badge bg-info-subtle text-info-emphasis",
  "primary-soft": "badge bg-primary-soft text-primary-emphasis",
  success: "badge bg-success-subtle text-success-emphasis",
};

export function SummaryPrioritySection({ keyMatters, decisionRecords }: Props) {
  if (!keyMatters.length && !decisionRecords.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">优先事项</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-3">
        <div>
          <div className="flex flex-col gap-3">
            {keyMatters.map((matter) => (
              <div key={matter.id} className="cockpit-card">
                <div className="cockpit-card-body">
                  <div className="flex items-start gap-3">
                    <span className="icon-lg text-surface-3 shrink-0">
                      <i className={`bi bi-${matter.icon}`}></i>
                    </span>
                    <div className="grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold mb-0">{matter.title}</h3>
                        <span className={badgeClassMap[matter.badgeStyle] ?? "badge bg-surface-2"}>
                          {matter.badge}
                        </span>
                      </div>
                      <p className="text-xs text-surface-2 mb-2">{matter.description}</p>
                      <span className="text-xs text-surface-3">{matter.timeLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="cockpit-card h-full">
            <div className="cockpit-card-body">
              <h3 className="text-sm font-semibold mb-2">本周决策</h3>
              <div className="flex flex-col gap-2">
                {decisionRecords.map((record, i) => (
                  <div key={i} className="p-2 bg-surface-1 rounded-lg">
                    <div className="text-xs font-medium mb-1">{record.title}</div>
                    <div className="text-xs text-surface-3">{record.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
