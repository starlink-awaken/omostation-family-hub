import { describe, expect, test } from "vitest";

import {
  FAMILY_CSRF_HEADER,
  csrfHeaders,
  getFamilyCsrfToken,
  hasValidCsrfHeader,
} from "./csrf";

describe("csrf helpers", () => {
  test("csrfHeaders returns the configured write token header", () => {
    process.env.FAMILY_CSRF_TOKEN = "test-token";

    expect(csrfHeaders()).toEqual({
      [FAMILY_CSRF_HEADER]: "test-token",
    });

    delete process.env.FAMILY_CSRF_TOKEN;
  });

  test("getFamilyCsrfToken supports local development fallback", () => {
    delete process.env.FAMILY_CSRF_TOKEN;
    delete process.env.NEXT_PUBLIC_FAMILY_CSRF_TOKEN;

    expect(getFamilyCsrfToken()).toBe("family-dashboard-write");
  });

  test("hasValidCsrfHeader validates the family write token", () => {
    process.env.FAMILY_CSRF_TOKEN = "test-token";
    const ok = new Headers(csrfHeaders());
    const bad = new Headers({ [FAMILY_CSRF_HEADER]: "wrong" });

    expect(hasValidCsrfHeader(ok)).toBe(true);
    expect(hasValidCsrfHeader(bad)).toBe(false);

    delete process.env.FAMILY_CSRF_TOKEN;
  });
});
