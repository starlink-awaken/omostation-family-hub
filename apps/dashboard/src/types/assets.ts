export type AssetsHeroSummary = {
  label: string;
  value: string;
  subtitle: string;
};

export type AssetsHeatStep = {
  label: string;
  description: string;
  stage: "done" | "current" | "stable" | "pending";
};

export type AssetsOverviewMiniCard = {
  label: string;
  value: string;
  description: string;
};

export type AssetsCoreCard = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeStyle: "info" | "warning" | "success" | "primary-soft";
  tags: string[];
  blockLabel: string;
  blockValue: string;
  stableLabel: string;
  stableValue: string;
  description: string;
  archiveLabel: string;
  sourcePath: string;
};

export type AssetsProgressItem = {
  id: string;
  icon: string;
  title: string;
  badge: string;
  badgeStyle: "warning" | "info" | "surface-2";
  description: string;
};

export type AssetsTimelineEntry = {
  id: string;
  icon: string;
  title: string;
  badge: string;
  badgeStyle: "warning" | "info" | "primary-soft" | "success";
  description: string;
};

export type AssetsArchiveEntry = {
  title: string;
  description: string;
  href: string;
};

export type AssetsStableItem = {
  title: string;
  description: string;
};

export type AssetsFooter = {
  title: string;
  description: string;
  tags: string[];
};

export type AssetsSectionData = {
  heroTags: string[];
  heroDescription: string | null;
  heroSummaries: AssetsHeroSummary[];
  overviewSummary: string | null;
  overviewTags: string[];
  heatSteps: AssetsHeatStep[];
  overviewMiniCards: AssetsOverviewMiniCard[];
  coreCards: AssetsCoreCard[];
  progressItems: AssetsProgressItem[];
  timeline: AssetsTimelineEntry[];
  archives: AssetsArchiveEntry[];
  stableItems: AssetsStableItem[];
  footer: AssetsFooter | null;
};
