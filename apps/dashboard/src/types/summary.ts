import type { DataMeta, Item, Link } from "./common";
import type { HomeSectionData } from "./home";

export type SummaryOverview = {
  current?: string;
  phase?: string;
  lastUpdated?: string;
};

export type SummaryData = {
  meta: DataMeta;
  overview: SummaryOverview;
  weekFocus: Item[];
  entries: {
    primary?: Link;
    secondary: Link[];
  };
  recentUpdates: Item[];
  signals: Item[];
  updatedAt?: string;
  homeSections?: HomeSectionData;
};
