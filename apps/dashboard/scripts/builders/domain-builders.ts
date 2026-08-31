import path from "node:path";

import { loadDomainManifest } from "../../src/lib/manifest";
import { extractSummaryFromMarkdown } from "../../src/lib/extract";
import type { HealthSectionData, HealthMemberCard, HealthArchiveEntry, HealthHeatmapItem, HealthPriorityCard, HealthSignalItem, HealthStableItem, HealthTimelineEntry, HealthNoteEntry, HealthFooter } from "../../src/types/health";
import type { HomeSectionData } from "../../src/types/home";
import type { MembersSectionData } from "../../src/types/members";
import type { GrowthSectionData } from "../../src/types/growth";
import type { DailySectionData } from "../../src/types/daily";
import type { AssetsSectionData } from "../../src/types/assets";
import { findUniqueSsotPath, readSsotFile, loadRawYaml, encodeDocHref, extractMemberName, getAvatarChar, getTagline, getMemberStatus } from "./common";

// --- Health section builders ---

type RawHealthYaml = {
  heroTags?: string[];
  overviewSummary?: string | null;
  overviewTags?: string[];
  heatmap?: Array<{
    name: string; level: string; percentage: number; color: string;
  }>;
  priorityCards?: Array<{ label: string; value: string | null }>;
  signals?: Array<{
    id: string; icon: string; iconStyle: string; title: string;
    timeBadge: string; description: string;
  }>;
  stableItems?: Array<{ title: string; description: string }>;
  timeline?: Array<{
    id: string; icon: string; iconStyle: string; title: string;
    tags?: string[]; description: string;
  }>;
  archives?: Array<{ title: string; description: string; href: string }>;
  notes?: Array<{ date: string; description: string }>;
  footer?: { title: string; description: string; tags: string[] } | null;
};

export async function buildHealthSections(): Promise<HealthSectionData> {
  const [manifest, rawYaml] = await Promise.all([
    loadDomainManifest("health"),
    loadRawYaml<RawHealthYaml>("health.yaml"),
  ]);

  const memberCards: HealthMemberCard[] = [];
  const archiveEntries: HealthArchiveEntry[] = [];

  for (const item of manifest.items) {
    const isArchive = item.sourcePath.includes("(专项档案)");

    if (isArchive) {
      archiveEntries.push({
        title: item.title,
        description: "",
        href: `/doc?path=${encodeURIComponent(item.sourcePath)}`,
      });
      continue;
    }

    if (item.sourcePath.endsWith("医疗汇总.md")) {
      const name = extractMemberName(item.title);
      let memberDescription = "";
      try {
        const sourceMarkdown = await readSsotFile(item.sourcePath);
        memberDescription = extractSummaryFromMarkdown(sourceMarkdown, 96) || "";
      } catch {
        memberDescription = "";
      }

      memberCards.push({
        id: item.id,
        name,
        avatarChar: getAvatarChar(name),
        tagline: getTagline(name),
        status: getMemberStatus(name),
        tags: [`下步：查看档案`],
        description: memberDescription,
        focus: null,
        next: null,
        archiveLabel: "看档案",
        sourcePath: item.sourcePath,
      });
    }
  }

  const heatmap: HealthHeatmapItem[] = (rawYaml.heatmap ?? []).map((h) => ({
    name: h.name,
    level: h.level,
    percentage: h.percentage,
    color: h.color as HealthHeatmapItem["color"],
  }));

  const priorityCards: HealthPriorityCard[] = (rawYaml.priorityCards ?? []).map((p) => ({
    label: p.label,
    value: p.value ?? null,
  }));

  const stableItems: HealthStableItem[] = (rawYaml.stableItems ?? []).map((s) => ({
    title: s.title,
    description: s.description,
  }));

  const notes: HealthNoteEntry[] = (rawYaml.notes ?? []).map((n) => ({
    date: n.date,
    description: n.description,
  }));

  const footer: HealthFooter | null = rawYaml.footer ?? null;

  const signals: HealthSignalItem[] = (rawYaml.signals ?? []).map((sig) => ({
    id: sig.id,
    icon: sig.icon,
    iconStyle: sig.iconStyle as HealthSignalItem["iconStyle"],
    title: sig.title,
    timeBadge: sig.timeBadge,
    description: sig.description,
  }));
  const timeline: HealthTimelineEntry[] = (rawYaml.timeline ?? []).map((tl) => ({
    id: tl.id,
    icon: tl.icon,
    iconStyle: tl.iconStyle as HealthTimelineEntry["iconStyle"],
    title: tl.title,
    tags: tl.tags ?? [],
    description: tl.description,
  }));
  const archives: HealthArchiveEntry[] = (rawYaml.archives ?? []).map((a) => ({
    title: a.title,
    description: a.description,
    href: a.href,
  }));

  return {
    heroTags: rawYaml.heroTags ?? [manifest.title, `${manifest.items.length} 位成员`],
    heroCards: [],
    overviewSummary: rawYaml.overviewSummary ?? null,
    overviewTags: rawYaml.overviewTags ?? [],
    attentionHeatmap: heatmap,
    priorityCards,
    members: memberCards,
    signals,
    stableItems,
    timeline,
    archives,
    notes,
    footer,
  };
}

// --- Members section builders ---

type RawMembersYaml = {
  membersSections?: {
    heroTags?: string[];
    heroDescription?: string | null;
    overviewCards?: Array<{ label: string; value: string; subtitle: string }>;
    focusStrip?: {
      primaryPerson: string; primaryDesc: string;
      extraCareCount: string; extraCareDesc: string;
      archiveCoverage: string; archiveDesc: string;
    } | null;
    signalCards?: Array<{
      id: string; avatarChar: string; name: string; tagline: string;
      statusLabel: string; intensity: string; intensityStyle: string;
      percentage: number; barColor: string; description: string;
    }>;
    coreCards?: Array<{
      id: string; avatarChar: string; name: string; tagline: string;
      statusLabel: string; statusStyle: string;
      roleTags: string[]; description: string; focus: string; next: string;
      archiveLabel: string; sourcePath: string;
    }>;
    signalItems?: Array<{
      id: string; icon: string; iconStyle: string;
      title: string; description: string;
    }>;
    rhythmEntries?: Array<{
      day: string; title: string; description: string; badge: string;
    }>;
    timeline?: Array<{
      id: string; icon: string; iconStyle: string;
      title: string; badge: string; badgeStyle: string; description: string;
    }>;
    archives?: Array<{ title: string; description: string; href: string }>;
    recentUpdates?: Array<{ timeLabel: string; description: string }>;
    footer?: {
      title: string; description: string; tags: string[];
    } | null;
  };
};

export async function buildMembersSections(): Promise<MembersSectionData> {
  const rawYaml = await loadRawYaml<RawMembersYaml>("members.yaml");
  const s = rawYaml.membersSections;

  return {
    heroTags: s?.heroTags ?? ["家庭成员", "家庭纪实"],
    heroDescription: s?.heroDescription ?? null,
    overviewCards: s?.overviewCards ?? [],
    focusStrip: s?.focusStrip ?? null,
    signalCards: (s?.signalCards ?? []).map((c) => ({
      ...c,
      intensityStyle: c.intensityStyle as "warning" | "primary" | "info" | "primary-soft" | "success",
      barColor: c.barColor as "warning" | "primary" | "info" | "primary-soft" | "success",
    })),
    coreCards: (s?.coreCards ?? []).map((c) => ({
      ...c,
      statusStyle: c.statusStyle as "warning" | "primary" | "info" | "primary-soft" | "success",
    })),
    signalItems: (s?.signalItems ?? []).map((si) => ({
      ...si,
      iconStyle: si.iconStyle as "warning" | "info" | "primary-soft" | "success",
    })),
    rhythmEntries: s?.rhythmEntries ?? [],
    timeline: (s?.timeline ?? []).map((t) => ({
      ...t,
      iconStyle: t.iconStyle as "warning" | "primary-soft" | "info" | "success",
      badgeStyle: t.badgeStyle as "warning" | "primary-soft" | "info" | "success",
    })),
    archives: (s?.archives ?? []).map((a) => ({
      ...a,
      href: encodeDocHref(a.href),
    })),
    recentUpdates: s?.recentUpdates ?? [],
    footer: s?.footer ?? null,
  };
}

// --- Growth section builders ---

type RawGrowthYaml = {
  growthSections?: {
    heroTags?: string[];
    heroDescription?: string | null;
    heroSummaries?: Array<{ label: string; value: string; subtitle: string }>;
    overviewStrip?: {
      summary?: string | null;
      tags?: string[];
      meterSteps?: Array<{ label: string; description: string; active: boolean }>;
      miniCards?: Array<{ label: string; value: string; subtitle: string }>;
    } | null;
    stageCards?: Array<{
      id: string; icon: string; title: string; subtitle: string;
      badge: string; badgeStyle: string; tags: string[];
      description: string; nextStep: string;
    }>;
    signals?: Array<{
      id: string; icon: string; iconStyle: string;
      title: string; description: string;
    }>;
    timeline?: Array<{
      id: string; icon: string; iconStyle: string;
      title: string; badge: string; badgeStyle: string; description: string;
    }>;
    stableItems?: Array<{ title: string; description: string }>;
    planEntries?: Array<{
      icon: string; title: string; description: string; href: string;
    }>;
    footer?: {
      title: string; description: string; tags: string[];
    } | null;
  };
};

export type GrowthRecord = {
  date: string;
  ageDays: number;
  ageLabel: string;
  height: number | null;
  weight: number | null;
  source: string;
};

function parseGrowthMeasurements(raw: string): GrowthRecord[] {
  const lines = raw.split("\n");
  const records: GrowthRecord[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes("完整测量记录")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith("|")) {
      if (records.length > 0) break;
      continue;
    }

    const cells = line.split("|").map(p => p.trim()).filter(Boolean);
    if (cells.length < 5) continue;
    if (cells[0].includes("日期") || cells[0].includes("---")) continue;
    if (!/^\d{4}/.test(cells[0])) continue;

    const ageLabel = cells[1];
    const dayMatch = ageLabel.match(/(\d+)天/);
    const ageDays = dayMatch ? parseInt(dayMatch[1]) : (ageLabel === "出生" ? 0 : 0);

    const height = cells[2] === "—" || cells[2] === "-" ? null : parseFloat(cells[2]);
    const weight = cells[3] === "—" || cells[3] === "-" ? null : parseFloat(cells[3]);

    if (height === null && weight === null) continue;
    if ((height !== null && isNaN(height)) || (weight !== null && isNaN(weight))) continue;

    records.push({ date: cells[0], ageDays, ageLabel, height, weight, source: cells[4] });
  }

  return records;
}

export async function buildGrowthSections(): Promise<GrowthSectionData> {
  const rawYaml = await loadRawYaml<RawGrowthYaml>("growth.yaml");
  const s = rawYaml.growthSections;

  let measurements: GrowthRecord[] = [];
  try {
    const vaccinePath = await findUniqueSsotPath("/疫苗接种计划.md");
    const growthPath = path.posix.join(path.posix.dirname(vaccinePath), "医疗汇总.md");
    const growthRaw = await readSsotFile(growthPath);
    measurements = parseGrowthMeasurements(growthRaw);
  } catch {}

  return {
    heroTags: s?.heroTags ?? ["育儿成长"],
    heroDescription: s?.heroDescription ?? null,
    heroSummaries: s?.heroSummaries ?? [],
    overviewStrip: s?.overviewStrip
      ? {
          summary: s.overviewStrip.summary ?? null,
          tags: s.overviewStrip.tags ?? [],
          meterSteps: s.overviewStrip.meterSteps ?? [],
          miniCards: s.overviewStrip.miniCards ?? [],
        }
      : null,
    stageCards: (s?.stageCards ?? []).map((sc) => ({
      ...sc,
      badgeStyle: sc.badgeStyle as "warning" | "primary-soft" | "info" | "success",
    })),
    signals: (s?.signals ?? []).map((sig) => ({
      ...sig,
      iconStyle: sig.iconStyle as "warning" | "primary-soft" | "info" | "success",
    })),
    timeline: (s?.timeline ?? []).map((t) => ({
      ...t,
      iconStyle: t.iconStyle as "warning" | "primary-soft" | "info" | "success",
      badgeStyle: t.badgeStyle as "warning" | "primary-soft" | "info" | "success",
    })),
    stableItems: s?.stableItems ?? [],
    planEntries: (s?.planEntries ?? []).map((e) => ({
      ...e,
      href: encodeDocHref(e.href),
    })),
    footer: s?.footer ?? null,
    measurements,
  };
}

// --- Daily section builders ---

type RawDailyYaml = {
  dailySections?: {
    heroTags?: string[];
    heroDescription?: string | null;
    heroSummaries?: Array<{ label: string; value: string; subtitle: string }>;
    overviewSummary?: string | null;
    overviewTags?: string[];
    heatSteps?: Array<{ label: string; description: string; active: boolean }>;
    overviewMiniCards?: Array<{ label: string; value: string; description: string }>;
    opsCards?: Array<{
      id: string; icon: string; title: string; subtitle: string;
      badge: string; badgeStyle: string; tags: string[];
      currentBlock: string; nextStep: string;
    }>;
    priorityItems?: Array<{
      id: string; index: number; title: string; description: string;
      timeLabel: string; isPrimary: boolean;
    }>;
    timeline?: Array<{
      id: string; icon: string; iconStyle: string;
      title: string; badge: string; badgeStyle: string; description: string;
    }>;
    stableItems?: Array<{ title: string; description: string }>;
    sharedEntries?: Array<{
      icon: string; title: string; description: string; href: string;
    }>;
    footer?: {
      title: string; description: string; tags: string[];
    } | null;
  };
};

export async function buildDailySections(): Promise<DailySectionData> {
  const rawYaml = await loadRawYaml<RawDailyYaml>("daily.yaml");
  const s = rawYaml.dailySections;

  return {
    heroTags: s?.heroTags ?? ["家庭日常"],
    heroDescription: s?.heroDescription ?? null,
    heroSummaries: s?.heroSummaries ?? [],
    overviewSummary: s?.overviewSummary ?? null,
    overviewTags: s?.overviewTags ?? [],
    heatSteps: s?.heatSteps ?? [],
    overviewMiniCards: s?.overviewMiniCards ?? [],
    opsCards: (s?.opsCards ?? []).map((o) => ({
      ...o,
      badgeStyle: o.badgeStyle as "warning" | "info" | "primary-soft" | "surface-2",
    })),
    priorityItems: s?.priorityItems ?? [],
    timeline: (s?.timeline ?? []).map((t) => ({
      ...t,
      iconStyle: t.iconStyle as "warning" | "primary-soft" | "info" | "success",
      badgeStyle: t.badgeStyle as "warning" | "primary-soft" | "info" | "success",
    })),
    stableItems: s?.stableItems ?? [],
    sharedEntries: (s?.sharedEntries ?? []).map((e) => ({
      ...e,
      href: encodeDocHref(e.href),
    })),
    footer: s?.footer ?? null,
  };
}

// --- Assets section builders ---

type RawAssetsYaml = {
  assetsSections?: {
    heroTags?: string[];
    heroDescription?: string | null;
    heroSummaries?: Array<{ label: string; value: string; subtitle: string }>;
    overviewSummary?: string | null;
    overviewTags?: string[];
    heatSteps?: Array<{ label: string; description: string; stage: string }>;
    overviewMiniCards?: Array<{ label: string; value: string; description: string }>;
    coreCards?: Array<{
      id: string; icon: string; title: string; subtitle: string;
      badge: string; badgeStyle: string; tags: string[];
      blockLabel: string; blockValue: string;
      stableLabel: string; stableValue: string;
      description: string; archiveLabel: string; sourcePath: string;
    }>;
    progressItems?: Array<{
      id: string; icon: string; title: string; badge: string;
      badgeStyle: string; description: string;
    }>;
    timeline?: Array<{
      id: string; icon: string; title: string; badge: string;
      badgeStyle: string; description: string;
    }>;
    archives?: Array<{ title: string; description: string; href: string }>;
    stableItems?: Array<{ title: string; description: string }>;
    footer?: {
      title: string; description: string; tags: string[];
    } | null;
  };
};

export async function buildAssetsSections(): Promise<AssetsSectionData> {
  const rawYaml = await loadRawYaml<RawAssetsYaml>("assets.yaml");
  const s = rawYaml.assetsSections;

  return {
    heroTags: s?.heroTags ?? ["资产设备"],
    heroDescription: s?.heroDescription ?? null,
    heroSummaries: s?.heroSummaries ?? [],
    overviewSummary: s?.overviewSummary ?? null,
    overviewTags: s?.overviewTags ?? [],
    heatSteps: (s?.heatSteps ?? []).map((h) => ({
      ...h,
      stage: h.stage as "done" | "current" | "stable" | "pending",
    })),
    overviewMiniCards: s?.overviewMiniCards ?? [],
    coreCards: (s?.coreCards ?? []).map((c) => ({
      ...c,
      badgeStyle: c.badgeStyle as "info" | "warning" | "success" | "primary-soft",
    })),
    progressItems: (s?.progressItems ?? []).map((p) => ({
      ...p,
      badgeStyle: p.badgeStyle as "warning" | "info" | "surface-2",
    })),
    timeline: (s?.timeline ?? []).map((t) => ({
      ...t,
      badgeStyle: t.badgeStyle as "warning" | "info" | "primary-soft" | "success",
    })),
    archives: (s?.archives ?? []).map((a) => ({
      ...a,
      href: encodeDocHref(a.href),
    })),
    stableItems: s?.stableItems ?? [],
    footer: s?.footer ?? null,
  };
}
