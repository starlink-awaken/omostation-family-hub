import { describe, expect, test } from "vitest";

import { redactText } from "./redact";

describe("redactText", () => {
  test("命中敏感数字时替换为◆◆", () => {
    expect(redactText("我的银行卡号 6222021234567890123")).toEqual({
      text: "我的◆◆号 6222021234567890123",
      redacted: true,
    });
  });

  test("命中身份证号时替换为◆◆", () => {
    expect(redactText("身份证号 11010119900307451X")).toEqual({
      text: "◆◆号 ◆◆",
      redacted: true,
    });
  });

  test("命中敏感关键词时替换敏感词本身", () => {
    expect(redactText("更新身份证信息")).toEqual({
      text: "更新◆◆信息",
      redacted: true,
    });
  });

  test("会折叠空白并保留非敏感内容", () => {
    expect(redactText("  家庭   周会\n如期进行  ")).toEqual({
      text: "家庭 周会 如期进行",
      redacted: false,
    });
  });

  test("超长非敏感文本会被截断", () => {
    expect(redactText("abcdef", 5)).toEqual({
      text: "abcd…",
      redacted: false,
    });
  });

  test("空字符串返回空结果", () => {
    expect(redactText("   ")).toEqual({
      text: "",
      redacted: false,
    });
  });

  test("普通财务描述词不过敏", () => {
    expect(redactText("本月家庭收入与支出情况")).toEqual({
      text: "本月家庭收入与支出情况",
      redacted: false,
    });
  });
});
