import { afterEach, describe, expect, test, vi } from "vitest";

import { sendPush } from "./push";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendPush", () => {
  test("BARK_API_KEY 未设置时不执行任何操作", async () => {
    vi.stubEnv("BARK_API_KEY", "");
    const fetchSpy = vi.spyOn(global, "fetch");

    await sendPush("标题", "内容");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("调用 fetch 并携带正确的 URL", async () => {
    vi.stubEnv("BARK_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response());

    await sendPush("标题", "内容");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("api.day.app");
    expect(url).toContain("test-key");
    expect(url).toContain(encodeURIComponent("标题"));
    expect(url).toContain(encodeURIComponent("内容"));
    expect(url).not.toContain("?url=");
  });

  test("提供 url 参数时拼接到查询参数", async () => {
    vi.stubEnv("BARK_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response());

    await sendPush("标题", "内容", "https://example.com/page");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("?url=");
    expect(url).toContain(encodeURIComponent("https://example.com/page"));
  });

  test("使用 AbortController 实现超时机制", async () => {
    vi.stubEnv("BARK_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response());

    await sendPush("标题", "内容");

    const options = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  test("fetch 抛出异常时不向上传播", async () => {
    vi.stubEnv("BARK_API_KEY", "test-key");
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("网络错误"));

    await expect(sendPush("标题", "内容")).resolves.toBeUndefined();
  });
});
