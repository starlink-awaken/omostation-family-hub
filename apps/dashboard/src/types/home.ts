export type HomeHeroCard = {
  label: string;
  value: string;
};

export type HomeStateStripCard = {
  label: string;
  value: string;
};

export type HomeKeyMatter = {
  id: string;
  icon: string;
  title: string;
  badge: string;
  badgeStyle: "warning" | "info" | "primary-soft" | "success";
  description: string;
  timeLabel: string;
};

export type HomeDecisionRecord = {
  title: string;
  description: string;
};

export type HomeSystemReminder = {
  icon: string;
  title: string;
  description: string;
};

export type HomeMemberCapsule = {
  id: string;
  avatarChar: string;
  name: string;
  tagline: string;
  description: string;
  archiveLabel: string;
  sourcePath: string;
};

export type HomeKnowledgeEntry = {
  icon: string;
  title: string;
  description: string;
  href: string;
};

export type HomeRecentUpdate = {
  title: string;
  description: string;
  timeBadge: string;
};

export type HomeTodayEntry = {
  title: string;
  href: string;
  isPrimary: boolean;
};

export type HomeFooter = {
  title: string;
  description: string;
  tags: string[];
};

export type HomeToolItem = {
  icon: string;
  title: string;
  description: string;
  href: string;
};

export type HomeSectionData = {
  heroCards: HomeHeroCard[];
  stateStripSummary: string | null;
  stateStripCards: HomeStateStripCard[];
  currentStateSummary: string | null;
  currentStateBadge: string | null;
  currentStateCards: HomeHeroCard[];
  overviewCards: HomeHeroCard[];
  keyMatters: HomeKeyMatter[];
  decisionRecords: HomeDecisionRecord[];
  systemReminders: HomeSystemReminder[];
  memberCapsules: HomeMemberCapsule[];
  knowledgeEntries: HomeKnowledgeEntry[];
  recentUpdates: HomeRecentUpdate[];
  todayEntries: HomeTodayEntry[];
  footer: HomeFooter | null;
  toolEntries: HomeToolItem[];
};
