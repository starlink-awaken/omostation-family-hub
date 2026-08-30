import type { DataMeta, Item, Link } from "./common";

export type HealthHeroCard = {
  label: string;
  value: string;
  subtitle: string;
};

export type HealthHeatmapItem = {
  name: string;
  level: string;
  percentage: number;
  color: "warning" | "primary" | "info" | "success" | "danger";
};

export type HealthPriorityCard = {
  label: string;
  value: string | null;
};

export type HealthMemberStatus = {
  label: string;
  variant: "warning" | "primary" | "info" | "success" | "danger" | "primary-soft";
};

export type HealthMemberCard = {
  id: string;
  name: string;
  avatarChar: string;
  tagline: string;
  status: HealthMemberStatus;
  tags: string[];
  description: string;
  focus: string | null;
  next: string | null;
  archiveLabel: string;
  sourcePath: string;
};

export type HealthSignalItem = {
  id: string;
  icon: string;
  iconStyle: "warning" | "primary-soft" | "info" | "success" | "danger";
  title: string;
  timeBadge: string;
  description: string;
};

export type HealthStableItem = {
  title: string;
  description: string;
};

export type HealthTimelineEntry = {
  id: string;
  icon: string;
  iconStyle: "warning" | "primary-soft" | "info" | "success" | "danger";
  title: string;
  tags: string[];
  description: string;
};

export type HealthArchiveEntry = {
  title: string;
  description: string;
  href: string;
};

export type HealthNoteEntry = {
  date: string;
  description: string;
};

export type HealthFooter = {
  title: string;
  description: string;
  tags: string[];
};

export type HealthSectionData = {
  heroTags: string[];
  heroCards: HealthHeroCard[];
  overviewSummary: string | null;
  overviewTags: string[];
  attentionHeatmap: HealthHeatmapItem[];
  priorityCards: HealthPriorityCard[];
  members: HealthMemberCard[];
  signals: HealthSignalItem[];
  stableItems: HealthStableItem[];
  timeline: HealthTimelineEntry[];
  archives: HealthArchiveEntry[];
  notes: HealthNoteEntry[];
  footer: HealthFooter | null;
};

export type HealthDomainData = {
  meta: DataMeta;
  overview: {
    title: string;
    description?: string;
    totalCount: number;
    sourceCount: number;
  };
  focus: Item[];
  nextActions: Item[];
  links: Link[];
  items: Item[];
  updatedAt: string;
  healthSections: HealthSectionData;
};
