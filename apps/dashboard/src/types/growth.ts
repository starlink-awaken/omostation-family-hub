export type GrowthHeroSummary = {
  label: string;
  value: string;
  subtitle: string;
};

export type GrowthMeterStep = {
  label: string;
  description: string;
  active: boolean;
};

export type GrowthOverviewStrip = {
  summary: string | null;
  tags: string[];
  meterSteps: GrowthMeterStep[];
  miniCards: GrowthHeroSummary[];
};

export type GrowthStageCard = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeStyle: "warning" | "primary-soft" | "info" | "success";
  tags: string[];
  description: string;
  nextStep: string;
};

export type GrowthSignalItem = {
  id: string;
  icon: string;
  iconStyle: "warning" | "primary-soft" | "info" | "success";
  title: string;
  description: string;
};

export type GrowthTimelineEntry = {
  id: string;
  icon: string;
  iconStyle: "warning" | "primary-soft" | "info" | "success";
  title: string;
  badge: string;
  badgeStyle: "warning" | "primary-soft" | "info" | "success";
  description: string;
};

export type GrowthStableItem = {
  title: string;
  description: string;
};

export type GrowthPlanEntry = {
  icon: string;
  title: string;
  description: string;
  href: string;
};

export type GrowthFooter = {
  title: string;
  description: string;
  tags: string[];
};

export type GrowthMeasurement = {
  date: string;
  ageDays: number;
  ageLabel: string;
  height: number | null;
  weight: number | null;
  source: string;
};

export type GrowthSectionData = {
  heroTags: string[];
  heroDescription: string | null;
  heroSummaries: GrowthHeroSummary[];
  overviewStrip: GrowthOverviewStrip | null;
  stageCards: GrowthStageCard[];
  signals: GrowthSignalItem[];
  timeline: GrowthTimelineEntry[];
  stableItems: GrowthStableItem[];
  planEntries: GrowthPlanEntry[];
  footer: GrowthFooter | null;
  measurements: GrowthMeasurement[];
};
