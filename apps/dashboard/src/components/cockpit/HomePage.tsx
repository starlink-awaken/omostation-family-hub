import type { SummaryData } from "@/types/summary";
import { SummaryHeroBand } from "./summary/SummaryHeroBand";
import { SummaryStateStrip } from "./summary/SummaryStateStrip";
import { SummaryCurrentState } from "./summary/SummaryCurrentState";
import { SummaryOverviewStrip } from "./summary/SummaryOverviewStrip";
import { SummaryPrioritySection } from "./summary/SummaryPrioritySection";
import { SummaryReminders } from "./summary/SummaryReminders";
import { SummaryMemberCapsules } from "./summary/SummaryMemberCapsules";
import { SummaryEntryGrid } from "./summary/SummaryEntryGrid";
import { SummaryRecentUpdates } from "./summary/SummaryRecentUpdates";
import { SummaryToolSection } from "./summary/SummaryToolSection";
import { SummaryFooter } from "./summary/SummaryFooter";
import { DailyBriefing } from "@/components/shared/DailyBriefing";
import { DashboardWidgets } from "@/components/dashboard/DashboardClient";
import { Card } from "@/components/shared/Card";
import Link from "next/link";

type Props = {
  data: SummaryData;
};

export function HomePage({ data }: Props) {
  const s = data.homeSections;

  if (!s) {
    return (
      <div className="text-center text-surface-3 py-5">
        <p>暂无首页数据</p>
      </div>
    );
  }

  return (
    <>
      <DailyBriefing />
      <DashboardWidgets />
      <Card padding="none" className="flex items-center gap-2 flex-wrap mb-4 px-4 py-2.5">
        <span className="text-xs font-semibold" style={{ color: "var(--family-text-2)" }}>
          🚀 快速入口
        </span>
        <Link
          href="/ask"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold no-underline family-transition"
          style={{ background: "var(--family-primary)", color: "#fff" }}
        >
          🤖 AI 问答
        </Link>
        <Link
          href="/graph"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold no-underline family-transition"
          style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
        >
          🕸️ 知识图谱
        </Link>
        <Link
          href="/timeline"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold no-underline family-transition"
          style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
        >
          📊 时间线
        </Link>
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold no-underline family-transition"
          style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
        >
          🏷️ 标签
        </Link>
        <Link
          href="/milestones"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold no-underline family-transition"
          style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
        >
          🏆 里程碑
        </Link>
      </Card>
      <SummaryHeroBand cards={s.heroCards} />
      <SummaryStateStrip summary={s.stateStripSummary} cards={s.stateStripCards} />
      <SummaryCurrentState summary={s.currentStateSummary} badge={s.currentStateBadge} cards={s.currentStateCards} />
      <SummaryOverviewStrip cards={s.overviewCards} />
      <SummaryPrioritySection keyMatters={s.keyMatters} decisionRecords={s.decisionRecords} />
      <SummaryReminders reminders={s.systemReminders} />
      <SummaryMemberCapsules capsules={s.memberCapsules} />
      <SummaryEntryGrid entries={s.knowledgeEntries} />
      <SummaryToolSection items={s.toolEntries} />
      <SummaryRecentUpdates updates={s.recentUpdates} />
      {s.todayEntries.length > 0 && (
        <section className="family-section">
          <h2 className="text-base font-semibold mb-3">今日先做</h2>
          <div className="flex flex-wrap gap-3">
            {s.todayEntries.map((entry, i) => (
              <a
                key={i}
                href={entry.href}
                className={`cockpit-card no-underline ${entry.isPrimary ? "border-warning" : ""}`}
              >
                <div className="cockpit-card-body flex items-center gap-2">
                  <span className="text-sm font-medium">{entry.title}</span>
                  {entry.isPrimary && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">优先</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
      <SummaryFooter footer={s.footer} />
    </>
  );
}
