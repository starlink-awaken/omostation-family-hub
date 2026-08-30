import { mkdtempSync, mkdirSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import {
  documentsRoot,
  resolveDocumentsPath,
  statePath,
  stateRoot,
} from "@/lib/paths";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("requires explicit absolute Documents and state roots", () => {
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "");
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", "");
  expect(() => documentsRoot()).toThrow("FAMILY_DOCUMENTS_ROOT is required");
  expect(() => stateRoot()).toThrow("FAMILY_DASHBOARD_STATE_ROOT is required");

  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "relative/documents");
  expect(() => documentsRoot()).toThrow("FAMILY_DOCUMENTS_ROOT must be absolute");
});

test("keeps Documents and state roots disjoint", () => {
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "/content/family");
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", "/workspace/runtime/family-hub/dashboard");
  expect(documentsRoot()).toBe("/content/family");
  expect(stateRoot()).toBe("/workspace/runtime/family-hub/dashboard");
  expect(statePath("generated", "tasks.json")).toBe(
    "/workspace/runtime/family-hub/dashboard/generated/tasks.json",
  );

  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", "/content/family/runtime");
  expect(() => stateRoot()).toThrow("must be outside Documents");
});

test("rejects Documents traversal, absolute paths, NUL, and symlink escape", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "family-documents-"));
  mkdirSync(path.join(root, "safe"));
  symlinkSync(os.tmpdir(), path.join(root, "safe", "escape"));
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", root);

  expect(resolveDocumentsPath("../outside.md")).toBeNull();
  expect(resolveDocumentsPath("/absolute.md")).toBeNull();
  expect(resolveDocumentsPath("safe/\0secret.md")).toBeNull();
  expect(resolveDocumentsPath("safe/escape/secret.md")).toBeNull();
  expect(resolveDocumentsPath("safe/document.md")).toBe(path.join(root, "safe", "document.md"));
});

test("rejects state traversal", () => {
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", "/content/family");
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", "/workspace/runtime/family-hub/dashboard");
  expect(() => statePath("..", "escape.json")).toThrow("state path escapes");
});

