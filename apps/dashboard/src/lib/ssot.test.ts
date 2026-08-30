import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { canWriteSsotPath, getSsotRoot, resolveSsotPath, ssotPath } from "./ssot";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ssot paths", () => {
  test("优先读取 FAMILY_SSOT_ROOT 环境变量", () => {
    vi.stubEnv("FAMILY_SSOT_ROOT", "/tmp/family-ssot");

    expect(getSsotRoot()).toBe("/tmp/family-ssot");
  });

  test("未设置环境变量时回退到当前目录上一级", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/family-dashboard-app");

    expect(getSsotRoot()).toBe("/workspace");
    expect(ssotPath("_knowledge", "members.md")).toBe(
      path.join("/workspace", "_knowledge", "members.md"),
    );
  });

  test("resolveSsotPath rejects traversal", () => {
    vi.stubEnv("FAMILY_SSOT_ROOT", "/ssot");
    expect(resolveSsotPath("../secret.md")).toBeNull();
    expect(resolveSsotPath("/absolute.md")).toBeNull();
  });

  test("resolveSsotPath resolves safe relative paths", () => {
    vi.stubEnv("FAMILY_SSOT_ROOT", "/ssot");
    expect(resolveSsotPath("_control/STATE.md")).toBe(
      path.join("/ssot", "_control", "STATE.md"),
    );
  });

  test("canWriteSsotPath allows governed markdown and yaml writes", () => {
    vi.stubEnv("FAMILY_SSOT_ROOT", "/ssot");

    expect(canWriteSsotPath("_knowledge/03.育儿成长/计划.md")).toBe(true);
    expect(canWriteSsotPath("_control/workflows/daily.yaml")).toBe(true);
  });

  test("canWriteSsotPath rejects secrets, traversal, and unsupported roots", () => {
    vi.stubEnv("FAMILY_SSOT_ROOT", "/ssot");

    expect(canWriteSsotPath(".env")).toBe(false);
    expect(canWriteSsotPath("../secret.md")).toBe(false);
    expect(canWriteSsotPath("_control/../_archive/old.md")).toBe(false);
    expect(canWriteSsotPath("_archive/old.md")).toBe(false);
    expect(canWriteSsotPath("_knowledge/photo.png")).toBe(false);
  });
});
