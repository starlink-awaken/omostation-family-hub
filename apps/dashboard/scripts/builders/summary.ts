import { loadSummaryManifest } from "../../src/lib/manifest";
import { extractSummaryFromMarkdown } from "../../src/lib/extract";
import { assertSummarySchema } from "../../src/lib/schema";
import type { Item } from "../../src/types/common";
import type { SummaryData } from "../../src/types/summary";
import type { HomeSectionData } from "../../src/types/home";
import { isoNow, readSsotFile, parseCurrentStatus, parseCurrentPhase, parseLastReviewed, parseSignalItems, parseTimelineItems, loadRawYaml } from "./common";

async function buildWeekFocus(): Promise<Item[]> {
  const manifest = await loadSummaryManifest();
  const items: Item[] = [];

  for (const item of manifest.weekFocus) {
    let summary: string | undefined;

    if (item.sourcePath) {
      const sourceMarkdown = await readSsotFile(item.sourcePath);
      summary = extractSummaryFromMarkdown(sourceMarkdown, 96);
    }

    items.push({
      id: item.id,
      title: item.title,
      summary,
      sourcePath: item.sourcePath,
      sensitivity: "private",
    });
  }

  return items;
}

type RawHomeYaml = {
  homeSections?: {
    heroCards?: Array<{ label: string; value: string }>;
    stateStripSummary?: string | null;
    stateStripCards?: Array<{ label: string; value: string }>;
    currentStateSummary?: string | null;
    currentStateBadge?: string | null;
    currentStateCards?: Array<{ label: string; value: string }>;
    overviewCards?: Array<{ label: string; value: string }>;
    keyMatters?: Array<{
      id: string; icon: string; title: string; badge: string;
      badgeStyle: string; description: string; timeLabel: string;
    }>;
    decisionRecords?: Array<{ title: string; description: string }>;
    systemReminders?: Array<{ icon: string; title: string; description: string }>;
    memberCapsules?: Array<{
      id: string; avatarChar: string; name: string; tagline: string;
      description: string; archiveLabel: string; sourcePath: string;
    }>;
    knowledgeEntries?: Array<{
      icon: string; title: string; description: string; href: string;
    }>;
    recentUpdates?: Array<{
      title: string; description: string; timeBadge: string;
    }>;
    todayEntries?: Array<{
      title: string; href: string; isPrimary: boolean;
    }>;
    toolEntries?: Array<{
      icon: string; title: string; description: string; href: string;
    }>;
    footer?: {
      title: string; description: string; tags: string[];
    } | null;
  };
};

async function buildHomeSections(): Promise<HomeSectionData> {
  const rawYaml = await loadRawYaml<RawHomeYaml>("summary.yaml");
  const s = rawYaml.homeSections;

  return {
    heroCards: s?.heroCards ?? [],
    stateStripSummary: s?.stateStripSummary ?? null,
    stateStripCards: s?.stateStripCards ?? [],
    currentStateSummary: s?.currentStateSummary ?? null,
    currentStateBadge: s?.currentStateBadge ?? null,
    currentStateCards: s?.currentStateCards ?? [],
    overviewCards: s?.overviewCards ?? [],
    keyMatters: (s?.keyMatters ?? []).map((m) => ({
      ...m,
      badgeStyle: m.badgeStyle as "warning" | "info" | "primary-soft" | "success",
    })),
    decisionRecords: s?.decisionRecords ?? [],
    systemReminders: s?.systemReminders ?? [],
    memberCapsules: s?.memberCapsules ?? [],
    knowledgeEntries: s?.knowledgeEntries ?? [],
    recentUpdates: s?.recentUpdates ?? [],
    todayEntries: s?.todayEntries ?? [],
    toolEntries: s?.toolEntries ?? [],
    footer: s?.footer ?? null,
  };
}

export async function buildSummary(): Promise<SummaryData> {
  const manifest = await loadSummaryManifest();
  const generatedAt = isoNow();
  const [statusMd, stateMd, signalsMd, timelineMd, weekFocus] =
    await Promise.all([
      readSsotFile("_control/STATUS.md"),
      readSsotFile("_control/STATE.md"),
      readSsotFile("_control/signals.md"),
      readSsotFile("_control/TIMELINE.md"),
      buildWeekFocus(),
    ]);

  const sources = [
    "_control/STATUS.md",
    "_control/STATE.md",
    "_control/signals.md",
    "_control/TIMELINE.md",
    ...weekFocus
      .map((item) => item.sourcePath)
      .filter((value): value is string => Boolean(value)),
  ];

  const summary: SummaryData = {
    meta: {
      schemaVersion: "v1",
      generatedAt,
      sources: [...new Set(sources)],
    },
    overview: {
      current: parseCurrentStatus(statusMd),
      phase: parseCurrentPhase(stateMd),
      lastUpdated: parseLastReviewed(stateMd),
    },
    weekFocus,
    entries: {
      primary: manifest.entries?.primary ? { title: manifest.entries.primary.title, href: manifest.entries.primary.sourcePath } : undefined,
      secondary: (manifest.entries?.secondary ?? []).map((e) => ({ title: e.title, href: e.sourcePath })),
    },
    recentUpdates: parseTimelineItems(timelineMd),
    signals: parseSignalItems(signalsMd),
    updatedAt: generatedAt,
    homeSections: await buildHomeSections(),
  };

  assertSummarySchema(summary);
  return summary;
}
