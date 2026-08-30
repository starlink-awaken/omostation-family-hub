import type { DomainData } from "@/types/domain";
import { AssetsHeroSection } from "./assets/AssetsHeroSection";
import { AssetsOverviewStrip } from "./assets/AssetsOverviewStrip";
import { AssetsCoreCards } from "./assets/AssetsCoreCards";
import { AssetsProgressItems } from "./assets/AssetsProgressItems";
import { AssetsTimeline } from "./assets/AssetsTimeline";
import { AssetsArchiveEntries } from "./assets/AssetsArchiveEntries";
import { AssetsStableItems } from "./assets/AssetsStableItems";
import { AssetsFooter } from "./assets/AssetsFooter";

type Props = {
  data: DomainData;
};

export function AssetsPage({ data }: Props) {
  const s = data.assetsSections;

  if (!s) {
    return (
      <div className="text-center text-surface-3 py-5">
        <p>暂无资产数据</p>
      </div>
    );
  }

  return (
    <>
      <AssetsHeroSection tags={s.heroTags} description={s.heroDescription} summaries={s.heroSummaries} />
      <AssetsOverviewStrip summary={s.overviewSummary} tags={s.overviewTags} heatSteps={s.heatSteps} miniCards={s.overviewMiniCards} />
      <AssetsCoreCards cards={s.coreCards} />
      <AssetsProgressItems items={s.progressItems} />
      <AssetsTimeline timeline={s.timeline} />
      <AssetsArchiveEntries archives={s.archives} />
      <AssetsStableItems items={s.stableItems} />
      <AssetsFooter footer={s.footer} />
    </>
  );
}
