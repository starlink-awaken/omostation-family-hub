import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { loadAppData } from "./data-loader";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadAppData", () => {
  test("reads generated JSON only from the explicit state root", async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-dashboard-state-"));
    const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-dashboard-documents-"));
    const generatedDir = path.join(stateRoot, "generated");
    await mkdir(generatedDir, { recursive: true });
    await writeFile(
      path.join(generatedDir, "summary.json"),
      JSON.stringify({ ok: true, count: 2 }),
      "utf8",
    );
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
    vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);

    await expect(loadAppData<{ ok: boolean; count: number }>("summary.json")).resolves.toEqual({
      ok: true,
      count: 2,
    });
  });
});
