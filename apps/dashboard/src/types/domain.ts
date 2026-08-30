import type { DataMeta, Item, Link } from "./common";
import type { HealthSectionData } from "./health";
import type { HomeSectionData } from "./home";
import type { MembersSectionData } from "./members";
import type { GrowthSectionData } from "./growth";
import type { DailySectionData } from "./daily";
import type { AssetsSectionData } from "./assets";

export type DomainKey =
  | "members"
  | "health"
  | "growth"
  | "daily"
  | "assets";

export type DomainOverview = {
  title: string;
  description?: string;
  totalCount: number;
  sourceCount: number;
};

export type DomainData = {
  meta: DataMeta;
  overview: DomainOverview;
  focus: Item[];
  nextActions: Item[];
  links: Link[];
  items: Item[];
  updatedAt: string;
  healthSections?: HealthSectionData;
  homeSections?: HomeSectionData;
  membersSections?: MembersSectionData;
  growthSections?: GrowthSectionData;
  dailySections?: DailySectionData;
  assetsSections?: AssetsSectionData;
};
