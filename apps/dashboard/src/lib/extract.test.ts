import { describe, expect, test } from "vitest";

import {
  extractSummaryFromMarkdown,
  normalizeInlineText,
  sanitizeCurrency,
} from "./extract";

describe("normalizeInlineText", () => {
  test("strips markdown links and formatting", () => {
    expect(
      normalizeInlineText("详见 [`保险`](保险.md) **重要** `code`"),
    ).toBe("详见 保险 重要 code");
  });
});

describe("sanitizeCurrency", () => {
  test("masks currency numbers", () => {
    expect(sanitizeCurrency("付款¥6,590 + 车衣（¥5,600+）")).toBe(
      "付款¥… + 车衣（¥…）",
    );
  });
});

describe("extractSummaryFromMarkdown", () => {
  test("prefers frontmatter description when safe", () => {
    const md = `---\ntitle: T\ndescription: 这是一段描述\n---\n\n# 标题\n正文`;
    expect(extractSummaryFromMarkdown(md, 80)).toBe("这是一段描述");
  });

  test("sanitizes currency in summary lines", () => {
    const md = `---\ntitle: T\n---\n\n# 标题\n\n- 月收入 到手约¥9,000\n- 这是安全摘要\n`;
    expect(extractSummaryFromMarkdown(md, 80)).toBe("月收入 到手约¥…");
  });

  test("skips '详见' lines that are just file pointers", () => {
    const md = `---\ntitle: T\n---\n\n详见 [a](a.md)\n\n可用摘要在这里\n`;
    expect(extractSummaryFromMarkdown(md, 80)).toBe("可用摘要在这里");
  });
});
