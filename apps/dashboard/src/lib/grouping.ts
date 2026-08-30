import type { Item } from "@/types/common";

export type ItemGroup = {
  title: string;
  match: string;
};

export type GroupedItems = {
  title: string;
  items: Item[];
};

export function groupMembersItems(items: Item[]): GroupedItems[] {
  const core: Item[] = [];
  const family: Item[] = [];
  const pets: Item[] = [];

  for (const item of items) {
    const p = item.sourcePath || "";
    if (p.includes("/宠物/")) {
      pets.push(item);
      continue;
    }
    if (item.title.includes("家族") || item.title.includes("谱系")) {
      family.push(item);
      continue;
    }
    core.push(item);
  }

  const groups: GroupedItems[] = [];
  if (core.length) groups.push({ title: "核心成员", items: core });
  if (family.length) groups.push({ title: "家族关系", items: family });
  if (pets.length) groups.push({ title: "宠物", items: pets });
  return groups;
}

export function groupHealthItems(items: Item[]): GroupedItems[] {
  const child: Item[] = [];
  const mom: Item[] = [];
  const me: Item[] = [];
  const archives: Item[] = [];
  const other: Item[] = [];

  for (const item of items) {
    const title = item.title || "";
    const sourceTitle = item.sourceTitle || "";
    if (sourceTitle.includes("专项")) {
      archives.push(item);
      continue;
    }
    if (title.includes("Synthetic Member 02")) {
      child.push(item);
      continue;
    }
    if (title.includes("Synthetic Member 06")) {
      mom.push(item);
      continue;
    }
    if (title.includes("Synthetic Member 01")) {
      me.push(item);
      continue;
    }
    other.push(item);
  }

  const groups: GroupedItems[] = [];
  if (child.length) groups.push({ title: "孩子（Synthetic Member 02）", items: child });
  if (mom.length) groups.push({ title: "妈妈（Synthetic Member 06）", items: mom });
  if (me.length) groups.push({ title: "我（Synthetic Member 01）", items: me });
  if (archives.length) groups.push({ title: "专项档案", items: archives });
  if (other.length) groups.push({ title: "其他", items: other });
  return groups;
}

export function groupBySourceTitle(
  items: Item[],
  order: ItemGroup[],
): GroupedItems[] {
  const buckets = new Map<string, Item[]>();
  const other: Item[] = [];

  for (const item of items) {
    const sourceTitle = (item.sourceTitle || "").trim();
    const matched = order.find((x) => x.match === sourceTitle);
    if (!matched) {
      other.push(item);
      continue;
    }
    const arr = buckets.get(matched.title) || [];
    arr.push(item);
    buckets.set(matched.title, arr);
  }

  const groups: GroupedItems[] = [];
  for (const g of order) {
    const list = buckets.get(g.title);
    if (list && list.length) groups.push({ title: g.title, items: list });
  }
  if (other.length) groups.push({ title: "其他", items: other });

  return groups;
}
