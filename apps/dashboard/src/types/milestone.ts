export type VaccineStatus = "确认" | "到期" | "即将到期" | "待接种" | "待确认" | "超期";

export type VaccineItem = {
  id: string;
  monthLabel: string;
  name: string;
  dose: string;
  plannedDate: string;
  actualDate: string | null;
  status: VaccineStatus;
  note: string;
  isOptional: boolean;
  freeStatus: "免费" | "自费";
};

export type CheckupItem = {
  monthLabel: string;
  items: string;
  suggestedDate: string;
  status: string;
};

export type VaccineData = {
  childName: string;
  birthDate: string;
  vaccines: VaccineItem[];
  optionalVaccines: VaccineItem[];
  checkups: CheckupItem[];
};

export type MilestoneStatus = "achieved" | "observing" | "upcoming" | "future";

export type MilestoneDomain =
  | "大运动"
  | "精细运动"
  | "语言"
  | "社交情感"
  | "认知"
  | "喂养"
  | "睡眠";

export type MilestoneItem = {
  id: string;
  monthRange: string;
  domain: MilestoneDomain;
  title: string;
  achievedDate: string | null;
  expectedDate: string | null;
  status: MilestoneStatus;
  note: string;
  important: boolean;
};

export type CheckupReminder = {
  monthLabel: string;
  item: string;
  suggestedDate: string;
};

export type MilestoneData = {
  childName: string;
  birthDate: string;
  milestones: MilestoneItem[];
  observing: MilestoneItem[];
  upcoming: MilestoneItem[];
  future: MilestoneItem[];
  checkups: CheckupReminder[];
  monthlyAlerts: { month: string; alerts: { topic: string; type: string }[] }[];
};
