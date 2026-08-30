import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { canWriteSsotPath, getSsotRoot, resolveSsotPath, ssotPath } from "./ssot";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ssot paths", () => {
  test("reads only the explicit FAMILY_DOCUMENTS_ROOT", () => {
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "/tmp/family-documents");

    expect(getSsotRoot()).toBe("/tmp/family-documents");
  });

  test("does not fall back to the current directory parent", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/family-dashboard-app");
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "");

    expect(() => getSsotRoot()).toThrow("FAMILY_DOCUMENTS_ROOT is required");
  });

  test("resolveSsotPath rejects traversal", () => {
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "/documents");
    expect(resolveSsotPath("../secret.md")).toBeNull();
    expect(resolveSsotPath("/absolute.md")).toBeNull();
  });

  test("resolveSsotPath resolves safe relative paths", () => {
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "/documents");
    expect(resolveSsotPath("_control/STATE.md")).toBe(
      path.join("/documents", "_control", "STATE.md"),
    );
    expect(ssotPath("_knowledge", "members.md")).toBe(
      path.join("/documents", "_knowledge", "members.md"),
    );
  });

  test("canWriteSsotPath allows governed markdown and yaml writes", () => {
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "/documents");

    expect(canWriteSsotPath("_knowledge/03.育儿成长/计划.md")).toBe(true);
    expect(canWriteSsotPath("_control/workflows/daily.yaml")).toBe(true);
  });

  test("canWriteSsotPath rejects secrets, traversal, and unsupported roots", () => {
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "/documents");

    expect(canWriteSsotPath(".env")).toBe(false);
    expect(canWriteSsotPath("../secret.md")).toBe(false);
    expect(canWriteSsotPath("_control/../_archive/old.md")).toBe(false);
    expect(canWriteSsotPath("_archive/old.md")).toBe(false);
    expect(canWriteSsotPath("_knowledge/photo.png")).toBe(false);
  });
});
