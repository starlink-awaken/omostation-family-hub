import { afterEach, describe, expect, test, vi } from "vitest";

const mockAiChat = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string>>());

vi.mock("@/lib/ai", () => ({
  aiChat: mockAiChat,
}));

import { autoTag, updateFrontmatterTags } from "./auto-tagger";

afterEach(() => {
  vi.clearAllMocks();
});

describe("autoTag", () => {
  test("调用 aiChat 并解析返回的标签", async () => {
    mockAiChat.mockResolvedValue("医疗, 健康, 检查");

    const tags = await autoTag("体检报告内容");

    expect(mockAiChat).toHaveBeenCalledTimes(1);
    expect(mockAiChat).toHaveBeenCalledWith([
      { role: "system", content: expect.any(String) },
      { role: "user", content: "体检报告内容" },
    ]);
    expect(tags).toEqual(["医疗", "健康", "检查"]);
  });

  test("合并已有标签并去重", async () => {
    mockAiChat.mockResolvedValue("医疗, 检查");

    const tags = await autoTag("体检报告内容", ["已有标签"]);

    expect(tags).toContain("已有标签");
    expect(tags).toContain("医疗");
    expect(tags).toContain("检查");
  });

  test("aiChat 异常时优雅降级返回空数组", async () => {
    mockAiChat.mockRejectedValue(new Error("API 错误"));

    const tags = await autoTag("体检报告内容");

    expect(tags).toEqual([]);
  });

  test("不超过 10 个标签限制", async () => {
    const manyTags = Array.from({ length: 15 }, (_, i) => `标签${i + 1}`).join(", ");
    mockAiChat.mockResolvedValue(manyTags);

    const tags = await autoTag("内容");

    expect(tags.length).toBeLessThanOrEqual(10);
  });

  test("空响应返回空数组", async () => {
    mockAiChat.mockResolvedValue("");

    const tags = await autoTag("内容");

    expect(tags).toEqual([]);
  });
});

describe("updateFrontmatterTags", () => {
  test("替换 frontmatter 中已有的 tags 行", () => {
    const md = "---\ntitle: 测试\ntags: [旧标签]\n---\n正文内容";
    const result = updateFrontmatterTags(md, ["新标签1", "新标签2"]);

    expect(result).toContain("tags: [新标签1, 新标签2]");
    expect(result).not.toContain("旧标签");
  });

  test("frontmatter 无 tags 行时新增", () => {
    const md = "---\ntitle: 测试\n---\n正文内容";
    const result = updateFrontmatterTags(md, ["新标签"]);

    expect(result).toContain("tags: [新标签]");
  });

  test("不存在 frontmatter 时自动创建", () => {
    const md = "纯文本内容";
    const result = updateFrontmatterTags(md, ["标签A", "标签B"]);

    expect(result).toContain("---");
    expect(result).toContain("tags: [标签A, 标签B]");
    expect(result).toContain("纯文本内容");
  });
});
