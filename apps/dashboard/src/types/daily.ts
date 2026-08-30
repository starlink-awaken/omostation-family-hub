export type DailyHeroSummary = {
  label: string;
  value: string;
  subtitle: string;
};

export type DailyHeatStep = {
  label: string;
  description: string;
  active: boolean;
};

export type DailyOverviewMiniCard = {
  label: string;
  value: string;
  description: string;
};

export type DailyOpsCard = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeStyle: "warning" | "info" | "primary-soft" | "surface-2";
  tags: string[];
  currentBlock: string;
  nextStep: string;
};

export type DailyPriorityItem = {
  id: string;
  index: number;
  title: string;
  description: string;
  timeLabel: string;
  isPrimary: boolean;
};

export type DailyTimelineEntry = {
  id: string;
  icon: string;
  iconStyle: "warning" | "primary-soft" | "info" | "success";
  title: string;
  badge: string;
  badgeStyle: "warning" | "primary-soft" | "info" | "success";
  description: string;
};

export type DailyStableItem = {
  title: string;
  description: string;
};

export type DailySharedEntry = {
  icon: string;
  title: string;
  description: string;
  href: string;
};

export type DailyFooter = {
  title: string;
  description: string;
  tags: string[];
};

export type DailySectionData = {
  heroTags: string[];
  heroDescription: string | null;
  heroSummaries: DailyHeroSummary[];
  overviewSummary: string | null;
  overviewTags: string[];
  heatSteps: DailyHeatStep[];
  overviewMiniCards: DailyOverviewMiniCard[];
  opsCards: DailyOpsCard[];
  priorityItems: DailyPriorityItem[];
  timeline: DailyTimelineEntry[];
  stableItems: DailyStableItem[];
  sharedEntries: DailySharedEntry[];
  footer: DailyFooter | null;
};
