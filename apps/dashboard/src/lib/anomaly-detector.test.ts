import { afterEach, describe, expect, test, vi } from "vitest";

const mockReadFile = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());
const mockGetSsotRoot = vi.hoisted(() => vi.fn<(...args: unknown[]) => string>());
const mockGetDueHealthReminders = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown[]>>());
const mockExtractAllTasks = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown[]>>());
const mockAiChat = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  default: { readFile: mockReadFile },
}));

vi.mock("@/lib/ssot", () => ({
  getSsotRoot: mockGetSsotRoot,
}));

vi.mock("@/lib/health-check", () => ({
  getDueHealthReminders: mockGetDueHealthReminders,
}));

vi.mock("@/lib/task-extractor", () => ({
  extractAllTasks: mockExtractAllTasks,
}));

vi.mock("@/lib/ai", () => ({
  aiChat: mockAiChat,
}));

import { checkAnomalies } from "./anomaly-detector";

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function financeMd(rows: string): string {
  return [
    "## 大件支出记录",
    "| 日期 | 项目 | 金额 | 备注 | 分类 |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "## 其他分类",
    "无关内容",
  ].join("\n");
}

describe("checkAnomalies", () => {
  test("无异常时返回空数组", async () => {
    mockGetSsotRoot.mockReturnValue("/ssot");
    mockReadFile.mockResolvedValue(financeMd("| 2025-05 | 空调 | ¥1,000 | 安装 | 家电 |\n| 2025-06 | 冰箱 | ¥1,100 | 送货 | 家电 |"));
    mockGetDueHealthReminders.mockResolvedValue([]);
    mockExtractAllTasks.mockResolvedValue([]);

    const result = await checkAnomalies();

    expect(result).toEqual([]);
  });

  test("检测到 spending_spike：大件支出波动超过 30%", async () => {
    mockGetSsotRoot.mockReturnValue("/ssot");
    mockReadFile.mockResolvedValue(financeMd("| 2025-05 | 空调 | ¥1,000 | 安装 | 家电 |\n| 2025-06 | 冰箱 | ¥3,000 | 送货 | 家电 |"));
    mockGetDueHealthReminders.mockResolvedValue([]);
    mockExtractAllTasks.mockResolvedValue([]);
    mockAiChat.mockResolvedValue("上月大件支出增长明显，请关注预算。");

    const result = await checkAnomalies();

    const spikes = result.filter((a) => a.type === "spending_spike");
    expect(spikes).toHaveLength(1);
    expect(spikes[0].title).toContain("增长");
    expect(spikes[0].severity).toBe("high");
  });

  test("检测到 health_due：健康提醒已过期", async () => {
    mockGetSsotRoot.mockReturnValue("/ssot");
    mockReadFile.mockResolvedValue(financeMd("| 2025-05 | 空调 | ¥1,000 | 安装 | 家电 |\n| 2025-06 | 冰箱 | ¥1,100 | 送货 | 家电 |"));
    mockGetDueHealthReminders.mockResolvedValue([
      {
        title: "疫苗接种",
        date: "2025-06-01",
        daysLeft: -5,
        type: "vaccination",
        memberName: "Synthetic Member 02",
      },
    ]);
    mockExtractAllTasks.mockResolvedValue([]);
    mockAiChat.mockResolvedValue("有健康提醒已过期，请及时处理。");

    const result = await checkAnomalies();

    const healthItems = result.filter((a) => a.type === "health_due");
    expect(healthItems).toHaveLength(1);
    expect(healthItems[0].title).toContain("健康提醒已过期");
  });

  test("检测到 task_overdue：任务已过期", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01"));

    mockGetSsotRoot.mockReturnValue("/ssot");
    mockReadFile.mockResolvedValue(financeMd("| 2025-05 | 空调 | ¥1,000 | 安装 | 家电 |\n| 2025-06 | 冰箱 | ¥1,100 | 送货 | 家电 |"));
    mockGetDueHealthReminders.mockResolvedValue([]);
    mockExtractAllTasks.mockResolvedValue([
      {
        id: "task-1",
        text: "缴纳物业费",
        done: false,
        sourcePath: "_storage/inbox/tasks.md",
        sourceTitle: "待办",
        domain: "日常",
        dueDate: "2025-06-15",
      },
    ]);
    mockAiChat.mockResolvedValue("有任务已过期，请及时处理。");

    const result = await checkAnomalies();

    const overdueTasks = result.filter((a) => a.type === "task_overdue");
    expect(overdueTasks).toHaveLength(1);
    expect(overdueTasks[0].title).toContain("任务已过期");
  });

  test("存在异常时包含 AI 总结", async () => {
    mockGetSsotRoot.mockReturnValue("/ssot");
    mockReadFile.mockResolvedValue(financeMd("| 2025-05 | 空调 | ¥1,000 | 安装 | 家电 |\n| 2025-06 | 冰箱 | ¥3,000 | 送货 | 家电 |"));
    mockGetDueHealthReminders.mockResolvedValue([]);
    mockExtractAllTasks.mockResolvedValue([]);
    mockAiChat.mockResolvedValue("上月大件支出增长明显，请关注预算。");

    const result = await checkAnomalies();

    const summary = result.find((a) => a.type === "summary");
    expect(summary).toBeDefined();
    expect(summary!.detail).toBe("上月大件支出增长明显，请关注预算。");
    expect(mockAiChat).toHaveBeenCalled();
  });
});
