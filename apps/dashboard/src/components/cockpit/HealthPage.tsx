import type { DomainData } from "@/types/domain";
import type { HealthSectionData } from "@/types/health";
import { HealthHeroSection } from "./health/HealthHeroSection";
import { HealthCoreMembers } from "./health/HealthCoreMembers";
import {
  HealthFollowUpSignals,
  HealthStableItems,
} from "./health/HealthSidePanel";
import {
  HealthTimeline,
  HealthArchives,
  HealthNotes,
} from "./health/HealthTimelineSection";
import { HealthFooterSection } from "./health/HealthFooter";
import { CompactTimeline } from "@/components/shared/CompactTimeline";

export function HealthPage({ data }: { data: DomainData }) {
  const sections: HealthSectionData = data.healthSections ?? {
    heroTags: [],
    heroCards: [],
    overviewSummary: null,
    overviewTags: [],
    attentionHeatmap: [],
    priorityCards: [],
    members: [],
    signals: [],
    stableItems: [],
    timeline: [],
    archives: [],
    notes: [],
    footer: null,
  };

  return (
    <div className="health-page">
      <HealthHeroSection
        title={data.overview.title}
        description={data.overview.description}
        sections={sections}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          <HealthCoreMembers members={sections.members} />
        </div>
        <aside className="flex flex-col gap-5 xl:col-span-4">
          <HealthFollowUpSignals signals={sections.signals} />
          <HealthStableItems items={sections.stableItems} />
        </aside>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
          <HealthTimeline entries={sections.timeline} />
        </div>
        <aside className="flex flex-col gap-5 xl:col-span-5">
          <HealthArchives entries={sections.archives} />
          <HealthNotes notes={sections.notes} />
        </aside>
      </div>

      <div className="mt-5">
        <CompactTimeline title="🏥 健康相关动态" filterType="🏥" />
      </div>

      <HealthFooterSection footer={sections.footer} />
    </div>
  );
}
