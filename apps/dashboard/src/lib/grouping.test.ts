import { describe, expect, test } from "vitest";

import type { Item } from "@/types/common";
import {
  groupMembersItems,
  groupHealthItems,
  groupBySourceTitle,
  type ItemGroup,
} from "./grouping";

describe("groupMembersItems", () => {
  test("groups pets separately and keeps stable order", () => {
    const items: Item[] = [
      { id: "a", title: "Synthetic Member 01", sourcePath: "_knowledge/01.成员档案/Synthetic Member 01/个人时间线.md" },
      { id: "b", title: "家族谱系", sourcePath: "_knowledge/01.成员档案/Synthetic Member 01/家族谱系.md" },
      { id: "c", title: "Synthetic Member 05", sourcePath: "_knowledge/01.成员档案/宠物/Synthetic Member 05.md" },
      { id: "d", title: "Synthetic Member 04", sourcePath: "_knowledge/01.成员档案/宠物/Synthetic Member 04.md" },
    ];

    const groups = groupMembersItems(items);
    expect(groups.map((g) => g.title)).toEqual(["核心成员", "家族关系", "宠物"]);
    expect(groups[0].items.map((x) => x.id)).toEqual(["a"]);
    expect(groups[1].items.map((x) => x.id)).toEqual(["b"]);
    expect(groups[2].items.map((x) => x.id)).toEqual(["c", "d"]);
  });
});

describe("groupBySourceTitle", () => {
  test("orders groups by provided order and buckets unknown into 其他", () => {
    const items: Item[] = [
      { id: "a", title: "A", sourceTitle: "对比分析" },
      { id: "b", title: "B", sourceTitle: "托育安排" },
      { id: "c", title: "C", sourceTitle: "未知" },
    ];

    const order: ItemGroup[] = [
      { title: "托育安排", match: "托育安排" },
      { title: "对比分析", match: "对比分析" },
    ];

    const groups = groupBySourceTitle(items, order);
    expect(groups.map((g) => g.title)).toEqual(["托育安排", "对比分析", "其他"]);
    expect(groups[0].items.map((x) => x.id)).toEqual(["b"]);
    expect(groups[1].items.map((x) => x.id)).toEqual(["a"]);
    expect(groups[2].items.map((x) => x.id)).toEqual(["c"]);
  });
});

describe("groupHealthItems", () => {
  test("groups by person and keeps archives separated", () => {
    const items: Item[] = [
      { id: "a", title: "Synthetic Member 01医疗汇总", sourceTitle: "医疗汇总" },
      { id: "b", title: "Synthetic Member 06医疗汇总", sourceTitle: "医疗汇总" },
      { id: "c", title: "Synthetic Member 02医疗汇总", sourceTitle: "医疗汇总" },
      { id: "d", title: "屈光发育档案", sourceTitle: "专项档案" },
    ];

    const groups = groupHealthItems(items);
    expect(groups.map((g) => g.title)).toEqual([
      "孩子（Synthetic Member 02）",
      "妈妈（Synthetic Member 06）",
      "我（Synthetic Member 01）",
      "专项档案",
    ]);
    expect(groups[0].items.map((x) => x.id)).toEqual(["c"]);
    expect(groups[1].items.map((x) => x.id)).toEqual(["b"]);
    expect(groups[2].items.map((x) => x.id)).toEqual(["a"]);
    expect(groups[3].items.map((x) => x.id)).toEqual(["d"]);
  });
});
