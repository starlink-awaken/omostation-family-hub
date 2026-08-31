import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import { readUniqueSsotFile } from "../../scripts/builders/common";

afterEach(() => {
  vi.unstubAllEnvs();
});

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "family-builder-documents-"));
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", root);
  return root;
}

test("reads the only SSOT file with the requested basename", async () => {
  const root = fixtureRoot();
  const parent = path.join(root, "_knowledge", "private", "member");
  mkdirSync(parent, { recursive: true });
  writeFileSync(path.join(parent, "target.md"), "expected\n", "utf8");

  await expect(readUniqueSsotFile("/target.md")).resolves.toBe("expected\n");
});

test("rejects a missing SSOT basename", async () => {
  const root = fixtureRoot();
  mkdirSync(path.join(root, "_knowledge"), { recursive: true });

  await expect(readUniqueSsotFile("/missing.md")).rejects.toThrow(
    "expected exactly one SSOT file matching /missing.md; found 0",
  );
});

test("rejects an ambiguous SSOT basename", async () => {
  const root = fixtureRoot();
  for (const directory of ["one", "two"]) {
    const parent = path.join(root, "_knowledge", directory);
    mkdirSync(parent, { recursive: true });
    writeFileSync(path.join(parent, "duplicate.md"), `${directory}\n`, "utf8");
  }

  await expect(readUniqueSsotFile("/duplicate.md")).rejects.toThrow(
    "expected exactly one SSOT file matching /duplicate.md; found 2",
  );
});
