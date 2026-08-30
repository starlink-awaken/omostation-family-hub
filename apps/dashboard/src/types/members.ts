export type MembersOverviewCard = {
  label: string;
  value: string;
  subtitle: string;
};

export type MembersFocusStrip = {
  primaryPerson: string;
  primaryDesc: string;
  extraCareCount: string;
  extraCareDesc: string;
  archiveCoverage: string;
  archiveDesc: string;
};

export type MembersSignalCard = {
  id: string;
  avatarChar: string;
  name: string;
  tagline: string;
  statusLabel: string;
  intensity: string;
  intensityStyle: "warning" | "primary" | "info" | "primary-soft" | "success";
  percentage: number;
  barColor: "warning" | "primary" | "info" | "primary-soft" | "success";
  description: string;
};

export type MembersCoreCard = {
  id: string;
  avatarChar: string;
  name: string;
  tagline: string;
  statusLabel: string;
  statusStyle: "warning" | "primary" | "info" | "primary-soft" | "success";
  roleTags: string[];
  description: string;
  focus: string;
  next: string;
  archiveLabel: string;
  sourcePath: string;
};

export type MembersSignalItem = {
  id: string;
  icon: string;
  iconStyle: "warning" | "info" | "primary-soft" | "success";
  title: string;
  description: string;
};

export type MembersRhythmEntry = {
  day: string;
  title: string;
  description: string;
  badge: string;
};

export type MembersTimelineEntry = {
  id: string;
  icon: string;
  iconStyle: "warning" | "primary-soft" | "info" | "success";
  title: string;
  badge: string;
  badgeStyle: "warning" | "primary-soft" | "info" | "success";
  description: string;
};

export type MembersArchiveEntry = {
  title: string;
  description: string;
  href: string;
};

export type MembersRecentUpdate = {
  timeLabel: string;
  description: string;
};

export type MembersFooter = {
  title: string;
  description: string;
  tags: string[];
};

export type MembersSectionData = {
  heroTags: string[];
  heroDescription: string | null;
  overviewCards: MembersOverviewCard[];
  focusStrip: MembersFocusStrip | null;
  signalCards: MembersSignalCard[];
  coreCards: MembersCoreCard[];
  signalItems: MembersSignalItem[];
  rhythmEntries: MembersRhythmEntry[];
  timeline: MembersTimelineEntry[];
  archives: MembersArchiveEntry[];
  recentUpdates: MembersRecentUpdate[];
  footer: MembersFooter | null;
};
