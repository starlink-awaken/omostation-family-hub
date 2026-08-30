import type { DomainData } from "@/types/domain";
import { MembersHeroSection } from "./members/MembersHeroSection";
import { MembersOverviewStrip } from "./members/MembersOverviewStrip";
import { MembersSignalBand } from "./members/MembersSignalBand";
import { MembersCoreCards } from "./members/MembersCoreCards";
import { MembersFocusSignals } from "./members/MembersFocusSignals";
import { MembersCareTimeline } from "./members/MembersCareTimeline";
import { MembersArchiveEntries } from "./members/MembersArchiveEntries";
import { MembersRecentUpdates } from "./members/MembersRecentUpdates";
import { MembersFooter } from "./members/MembersFooter";

type Props = {
  data: DomainData;
};

export function MembersPage({ data }: Props) {
  const s = data.membersSections;

  if (!s) {
    return (
      <div className="text-center text-surface-3 py-5">
        <p>暂无成员数据</p>
      </div>
    );
  }

  return (
    <>
      <MembersHeroSection tags={s.heroTags} description={s.heroDescription} />
      <MembersOverviewStrip cards={s.overviewCards} focusStrip={s.focusStrip} />
      <MembersSignalBand signalCards={s.signalCards} />
      <MembersCoreCards cards={s.coreCards} />
      <MembersFocusSignals signalItems={s.signalItems} />
      <MembersCareTimeline timeline={s.timeline} />
      <MembersArchiveEntries archives={s.archives} />
      <MembersRecentUpdates updates={s.recentUpdates} />
      <MembersFooter footer={s.footer} />
    </>
  );
}
