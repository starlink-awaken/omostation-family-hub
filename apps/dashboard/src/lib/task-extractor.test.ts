import { describe, expect, test } from "vitest";

import { extractTasksFromMd, scannablePaths } from "./task-extractor";

describe("extractTasksFromMd", () => {
  test("解析 - [ ] 待办任务", () => {
    const content = "- [ ] 买菜\n- [ ] 洗衣服";
    const tasks = extractTasksFromMd(content, "_storage/inbox/今日任务.md");

    expect(tasks).toHaveLength(2);
    expect(tasks[0].text).toBe("买菜");
    expect(tasks[0].done).toBe(false);
    expect(tasks[1].text).toBe("洗衣服");
    expect(tasks[1].done).toBe(false);
  });

  test("解析 - [x] 已完成任务", () => {
    const content = "- [x] 完成报告";
    const tasks = extractTasksFromMd(content, "_storage/inbox/今日任务.md");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe("完成报告");
    expect(tasks[0].done).toBe(true);
  });

  test("提取 dueDate 到期字段", () => {
    const content = "- [ ] 体检预约 到期：2025-12-31";
    const tasks = extractTasksFromMd(content, "_storage/inbox/今日任务.md");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].dueDate).toBe("2025-12-31");
  });

  test("从 frontmatter 提取 sourceTitle", () => {
    const content = "---\ntitle: 家庭采购清单\n---\n- [ ] 买牛奶";
    const tasks = extractTasksFromMd(content, "_storage/inbox/采购.md");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].sourceTitle).toBe("家庭采购清单");
  });

  test("根据 _knowledge 路径推断 domain", () => {
    const content = "- [ ] 挂号";
    const tasks = extractTasksFromMd(content, "_knowledge/01.医疗健康/就医记录.md");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].domain).toBe("医疗");
  });

  test("处理空内容返回空数组", () => {
    const tasks = extractTasksFromMd("", "_storage/inbox/empty.md");

    expect(tasks).toEqual([]);
  });

  test("跳过非 checkbox 行", () => {
    const content = [
      "# 标题",
      "普通文本段落",
      "- 无序列表项",
      "1. 有序列表",
      "- [ ] 只有这个才是任务",
    ].join("\n");
    const tasks = extractTasksFromMd(content, "_storage/inbox/test.md");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe("只有这个才是任务");
  });
});

describe("scannablePaths", () => {
  test("返回预期的扫描路径数组", () => {
    expect(scannablePaths()).toEqual([
      "_knowledge/",
      "_entities/",
      "_storage/inbox/",
      "_storage/99-中转/",
    ]);
  });
});
