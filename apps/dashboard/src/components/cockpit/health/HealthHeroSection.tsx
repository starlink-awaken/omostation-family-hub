import type { HealthSectionData } from "@/types/health";

export function HealthHeroSection({
  title,
  description,
  sections,
}: {
  title: string;
  description?: string;
  sections: HealthSectionData;
}) {
  const tags = sections.heroTags;
  const cards = sections.heroCards;

  return (
    <section className="mb-8">
      <div
        className="surface-panel overflow-hidden p-5 sm:p-6 lg:p-7"
        style={{
          border: "1px solid var(--family-border)",
          borderRadius: "var(--family-radius-lg)",
          background: "var(--family-surface)",
        }}
      >
        <div className="flex flex-col gap-5 lg:gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1
                className="family-h1"
                style={{
                  fontSize: "clamp(28px, 5vw, 38px)",
                  textWrap: "balance",
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                }}
              >
                {title}
              </h1>
              {description ? (
                <p
                  className="mt-3 max-w-3xl text-sm sm:text-[15px]"
                  style={{ color: "var(--family-text-2)" }}
                >
                  {description}
                </p>
              ) : null}
              {tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold"
                      style={
                        tag === tags[0]
                          ? { background: "var(--family-primary-soft)", color: "var(--family-primary)" }
                          : { background: "var(--family-surface-2)", color: "var(--family-text-2)" }
                      }
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {cards.length > 0 ? (
              <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-[420px] lg:flex-none">
                {cards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface)",
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
                      {card.label}
                    </p>
                    <p className="mt-2 truncate text-base font-semibold" style={{ color: "var(--family-text)" }}>
                      {card.value}
                    </p>
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--family-text-2)" }}>
                      {card.subtitle}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-[420px] lg:flex-none">
                <div
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: "var(--family-border)",
                    background: "var(--family-surface-2)",
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
                    当前主焦
                  </p>
                  <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
                    暂无摘要数据
                  </p>
                </div>
                <div
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: "var(--family-border)",
                    background: "var(--family-surface-2)",
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
                    近期随访
                  </p>
                  <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
                    暂无数据
                  </p>
                </div>
                <div
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: "var(--family-border)",
                    background: "var(--family-surface-2)",
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
                    风险主题
                  </p>
                  <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
                    暂无数据
                  </p>
                </div>
              </div>
            )}
          </div>

          <HealthOverviewStrip sections={sections} />
        </div>
      </div>
    </section>
  );
}

function HealthOverviewStrip({ sections }: { sections: HealthSectionData }) {
  const { overviewSummary, overviewTags, attentionHeatmap, priorityCards } = sections;
  const hasHeatmap = attentionHeatmap.length > 0;
  const hasPriority = priorityCards.some((p) => p.value !== null);
  const hasContent = overviewSummary || overviewTags.length > 0 || hasHeatmap || hasPriority;

  if (!hasContent) {
    return (
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{
          borderColor: "var(--family-border)",
          background: "var(--family-surface)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--family-text-2)" }}>
          暂无总览摘要。可通过 <code style={{ color: "var(--family-text)" }}>data-manifest/health.yaml</code> 配置 overviewSummary 与 heatmap。
        </p>
      </div>
    );
  }

  return (
    <div
      className="overview-strip rounded-2xl border p-4 sm:p-5"
      style={{
        borderColor: "var(--family-border)",
        background: "linear-gradient(135deg, var(--family-primary-soft) 0%, var(--family-surface) 68%)",
      }}
    >
      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        <div className="xl:col-span-7">
          {overviewTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
                style={{ background: "var(--family-primary)", color: "var(--family-surface)" }}
              >
                健康总览条
              </span>
              {overviewTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium"
                  style={{ background: "var(--family-surface)", color: "var(--family-text-2)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {overviewSummary ? (
            <p className="mt-3 text-base font-semibold sm:text-lg" style={{ color: "var(--family-text)" }}>
              {overviewSummary}
            </p>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--family-text-2)" }}>
              总览摘要待补充
            </p>
          )}
        </div>
        <div className="grid gap-3 xl:col-span-5">
          {hasHeatmap ? (
            <div
              className="heat-card rounded-2xl border p-4"
              style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                    关注热度
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--family-text-2)" }}>
                    家庭健康关注热度带
                  </p>
                </div>
                <span
                  className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
                  style={{ background: "var(--family-surface)", color: "var(--family-text-2)" }}
                >
                  本周
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {attentionHeatmap.map((item) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-semibold" style={{ color: "var(--family-text)" }}>
                        {item.name}
                      </span>
                      <span className="truncate text-xs" style={{ color: "var(--family-text-2)" }}>
                        {item.level}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--family-surface-2)" }}>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${item.percentage}%`, background: `var(--family-${item.color})` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {hasPriority ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {priorityCards.map((card) =>
                card.value ? (
                  <div
                    key={card.label}
                    className="rounded-2xl border p-3"
                    style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
                      {card.label}
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                      {card.value}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
