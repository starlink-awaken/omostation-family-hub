import type { DomainData } from "@/types/domain";
import { GrowthHeroSection } from "./growth/GrowthHeroSection";
import { GrowthOverviewStrip } from "./growth/GrowthOverviewStrip";
import { GrowthStageCards } from "./growth/GrowthStageCards";
import { GrowthSignals } from "./growth/GrowthSignals";
import { GrowthTimeline } from "./growth/GrowthTimeline";
import { GrowthStableItems } from "./growth/GrowthStableItems";
import { GrowthPlanEntries } from "./growth/GrowthPlanEntries";
import { GrowthFooter } from "./growth/GrowthFooter";
import { CompactTimeline } from "@/components/shared/CompactTimeline";
import { GrowthCurveChart } from "@/components/shared/GrowthCurveChart";
import { Card } from "@/components/shared/Card";

type Props = {
  data: DomainData;
};

export function GrowthPage({ data }: Props) {
  const s = data.growthSections;

  if (!s) {
    return (
      <div className="text-center text-surface-3 py-5">
        <p>暂无成长数据</p>
      </div>
    );
  }

  return (
    <>
      <GrowthHeroSection tags={s.heroTags} description={s.heroDescription} summaries={s.heroSummaries} />
      <GrowthOverviewStrip strip={s.overviewStrip} />
      <GrowthStageCards cards={s.stageCards} />
      <GrowthSignals signals={s.signals} />
      <GrowthTimeline timeline={s.timeline} />
      <GrowthStableItems items={s.stableItems} />
      <GrowthPlanEntries entries={s.planEntries} />
      <Card>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
          📈 生长曲线（Synthetic Member 02）
        </h3>
        <GrowthCurveChart />
      </Card>
      <CompactTimeline title="🟢 成长相关动态" filterType="🟢" />
      <GrowthFooter footer={s.footer} />
    </>
  );
}
