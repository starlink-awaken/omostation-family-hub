import { afterEach, describe, expect, test, vi } from "vitest";

import { authenticateCron } from "./cron-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authenticateCron", () => {
  const VALID_TOKEN = "my-secret-cron-token";

  test("携带有效 token 返回 ok", () => {
    vi.stubEnv("FAMILY_CRON_TOKEN", VALID_TOKEN);
    const request = new Request("https://example.com/api/cron?cron_token=my-secret-cron-token");

    const result = authenticateCron(request);

    expect(result).toEqual({ ok: true });
  });

  test("缺少 token 返回 unauthorized", () => {
    vi.stubEnv("FAMILY_CRON_TOKEN", VALID_TOKEN);
    const request = new Request("https://example.com/api/cron");

    const result = authenticateCron(request);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  test("token 错误返回 unauthorized", () => {
    vi.stubEnv("FAMILY_CRON_TOKEN", VALID_TOKEN);
    const request = new Request("https://example.com/api/cron?cron_token=wrong-token");

    const result = authenticateCron(request);

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  test("URL 包含额外查询参数时仍能正确鉴权", () => {
    vi.stubEnv("FAMILY_CRON_TOKEN", VALID_TOKEN);
    const request = new Request("https://example.com/api/cron?cron_token=my-secret-cron-token&foo=bar&baz=1");

    const result = authenticateCron(request);

    expect(result).toEqual({ ok: true });
  });
});
