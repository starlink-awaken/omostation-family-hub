import type { DomainData } from "@/types/domain";
import { DailyHeroSection } from "./daily/DailyHeroSection";
import { DailyOverviewStrip } from "./daily/DailyOverviewStrip";
import { DailyOpsCards } from "./daily/DailyOpsCards";
import { DailyPrioritySection } from "./daily/DailyPrioritySection";
import { DailyTimeline } from "./daily/DailyTimeline";
import { DailyStableItems } from "./daily/DailyStableItems";
import { DailySharedEntries } from "./daily/DailySharedEntries";
import { DailyFooter } from "./daily/DailyFooter";

type Props = {
  data: DomainData;
};

export function DailyPage({ data }: Props) {
  const s = data.dailySections;

  if (!s) {
    return (
      <div className="text-center text-surface-3 py-5">
        <p>暂无日常数据</p>
      </div>
    );
  }

  return (
    <>
      <DailyHeroSection tags={s.heroTags} description={s.heroDescription} summaries={s.heroSummaries} />
      <DailyOverviewStrip summary={s.overviewSummary} tags={s.overviewTags} heatSteps={s.heatSteps} miniCards={s.overviewMiniCards} />
      <DailyOpsCards cards={s.opsCards} />
      <DailyPrioritySection items={s.priorityItems} />
      <DailyTimeline timeline={s.timeline} />
      <DailyStableItems items={s.stableItems} />
      <DailySharedEntries entries={s.sharedEntries} />
      <DailyFooter footer={s.footer} />
    </>
  );
}
