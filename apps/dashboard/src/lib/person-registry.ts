import type { MembersCoreCard } from "@/types/members";

export type PersonEntry = {
  slug: string;
  name: string;
  avatarChar: string;
  tagline: string;
  statusLabel: string;
  statusStyle: string;
  roleTags: string[];
  description: string;
  focus: string | null;
  next: string | null;
  sourcePath: string;
  archiveLabel: string;
  relatedLinks: {
    label: string;
    href: string;
    description: string;
  }[];
};

const PERSON_LINKS: Record<string, PersonEntry["relatedLinks"]> = {
  xiaoweizhen: [
    { label: "托育计划", href: "/doc?path=_knowledge/03.育儿成长/规划文档/爱蓓乐托育计划.md", description: "入托适应安排" },
    { label: "育儿成长", href: "/growth", description: "成长总览页" },
  ],
  xiaobai: [
    { label: "动物行为方案", href: "/doc?path=_knowledge/04.家庭日常/01.健康管理/宠物/2026-05-31猫咪行为调整方案.md", description: "猫咪行为调整方案" },
  ],
};

function slugFromName(name: string): string {
  const map: Record<string, string> = {
    "Synthetic Member 01": "xiamingxing",
    "Synthetic Member 06": "qinzhangyao",
    "Synthetic Member 02": "xiaoweizhen",
    "Synthetic Member 04": "xiaobai",
    "Synthetic Member 05": "diandian",
  };
  return map[name] ?? name;
}

export function personSlugFromId(id: string): string {
  const known: Record<string, string> = {
    "core-xiamingxing": "xiamingxing",
    "core-qinzhangyao": "qinzhangyao",
    "core-xiaweizhen": "xiaoweizhen",
    "core-parents": "parents",
    "core-pets": "pets",
  };
  return known[id] ?? id;
}

export function buildPersonEntries(cards: MembersCoreCard[]): PersonEntry[] {
  const entries: PersonEntry[] = [];
  for (const card of cards) {
    const slug = slugFromName(card.name);
    if (!slug) continue;
    entries.push({
      slug,
      name: card.name,
      avatarChar: card.avatarChar,
      tagline: card.tagline,
      statusLabel: card.statusLabel,
      statusStyle: card.statusStyle,
      roleTags: card.roleTags,
      description: card.description,
      focus: card.focus,
      next: card.next,
      sourcePath: card.sourcePath,
      archiveLabel: card.archiveLabel,
      relatedLinks: PERSON_LINKS[slug] ?? [],
    });
  }
  return entries;
}
