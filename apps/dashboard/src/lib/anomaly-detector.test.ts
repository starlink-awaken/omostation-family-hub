import { afterEach, describe, expect, test, vi } from "vitest";

const mockReadFile = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());
const mockStatePath = vi.hoisted(() => vi.fn((...parts: string[]) => `/state/${parts.join("/")}`));
const mockAiChat = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  default: { readFile: mockReadFile },
}));

vi.mock("@/lib/paths", () => ({ statePath: mockStatePath }));
vi.mock("@/lib/ai", () => ({ aiChat: mockAiChat }));

import { checkAnomalies } from "./anomaly-detector";

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function useGeneratedData({
  finance = { monthlyTotals: { "2025-05": 1000, "2025-06": 1100 } },
  health = { reminders: [] },
  tasks = { tasks: [] },
}: {
  finance?: unknown;
  health?: unknown;
  tasks?: unknown;
} = {}): void {
  mockReadFile.mockImplementation(async (filePath: unknown) => {
    const generatedPath = String(filePath);
    if (generatedPath.endsWith("finance.json")) return JSON.stringify(finance);
    if (generatedPath.endsWith("health.json")) return JSON.stringify(health);
    if (generatedPath.endsWith("tasks.json")) return JSON.stringify(tasks);
    throw new Error(`unexpected generated path: ${generatedPath}`);
  });
}

describe("checkAnomalies", () => {
  test("无异常时返回空数组", async () => {
    useGeneratedData();
    await expect(checkAnomalies()).resolves.toEqual([]);
  });

  test("检测到 spending_spike：大件支出波动超过 30%", async () => {
    useGeneratedData({ finance: { monthlyTotals: { "2025-05": 1000, "2025-06": 3000 } } });
    mockAiChat.mockResolvedValue("上月大件支出增长明显，请关注预算。");

    const result = await checkAnomalies();

    const spikes = result.filter((anomaly) => anomaly.type === "spending_spike");
    expect(spikes).toHaveLength(1);
    expect(spikes[0].title).toContain("增长");
    expect(spikes[0].severity).toBe("high");
  });

  test("检测到 health_due：健康提醒已过期", async () => {
    useGeneratedData({
      health: {
        reminders: [
          {
            title: "疫苗接种",
            date: "2025-06-01",
            daysLeft: -5,
            type: "vaccination",
            memberName: "Synthetic Member 02",
          },
        ],
      },
    });
    mockAiChat.mockResolvedValue("有健康提醒已过期，请及时处理。");

    const result = await checkAnomalies();

    const healthItems = result.filter((anomaly) => anomaly.type === "health_due");
    expect(healthItems).toHaveLength(1);
    expect(healthItems[0].title).toContain("健康提醒已过期");
  });

  test("检测到 task_overdue：任务已过期", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01"));
    useGeneratedData({
      tasks: {
        tasks: [
          {
            id: "task-1",
            text: "缴纳物业费",
            done: false,
            sourceTitle: "待办",
            dueDate: "2025-06-15",
          },
        ],
      },
    });
    mockAiChat.mockResolvedValue("有任务已过期，请及时处理。");

    const result = await checkAnomalies();

    const overdueTasks = result.filter((anomaly) => anomaly.type === "task_overdue");
    expect(overdueTasks).toHaveLength(1);
    expect(overdueTasks[0].title).toContain("任务已过期");
  });

  test("存在异常时包含 AI 总结", async () => {
    useGeneratedData({ finance: { monthlyTotals: { "2025-05": 1000, "2025-06": 3000 } } });
    mockAiChat.mockResolvedValue("上月大件支出增长明显，请关注预算。");

    const result = await checkAnomalies();

    const summary = result.find((anomaly) => anomaly.type === "summary");
    expect(summary).toBeDefined();
    expect(summary!.detail).toBe("上月大件支出增长明显，请关注预算。");
    expect(mockAiChat).toHaveBeenCalled();
  });
});
