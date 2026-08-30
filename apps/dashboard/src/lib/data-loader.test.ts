import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { loadAppData } from "./data-loader";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadAppData", () => {
  test("从 app-data 目录读取并解析 JSON", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "family-dashboard-app-data-"));
    const appDataDir = path.join(cwd, "app-data");
    await mkdir(appDataDir, { recursive: true });
    await writeFile(
      path.join(appDataDir, "summary.json"),
      JSON.stringify({ ok: true, count: 2 }),
      "utf8",
    );
    vi.spyOn(process, "cwd").mockReturnValue(cwd);

    await expect(loadAppData<{ ok: boolean; count: number }>("summary.json")).resolves.toEqual({
      ok: true,
      count: 2,
    });
  });
});
