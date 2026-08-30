import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { loadDomainManifest, loadSummaryManifest } from "./manifest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("manifest loaders", () => {
  test("缺省 summary manifest 时使用内置导航兜底", async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-dashboard-state-"));
    const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-dashboard-documents-"));
    const manifestDir = path.join(stateRoot, "manifests");
    await mkdir(manifestDir, { recursive: true });
    await writeFile(path.join(manifestDir, "summary.yaml"), "{}", "utf8");
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
    vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);

    await expect(loadSummaryManifest()).resolves.toEqual({
      weekFocus: [],
      entries: {
        primary: { title: "家庭成员", href: "/members" },
        secondary: [
          { title: "医疗健康", href: "/health" },
          { title: "育儿成长", href: "/growth" },
          { title: "家庭日常", href: "/daily" },
          { title: "资产设备", href: "/assets" },
        ],
      },
    });
  });

  test("domain manifest 会合并 YAML 内容与默认值", async () => {
    const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-dashboard-state-"));
    const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-dashboard-documents-"));
    const manifestDir = path.join(stateRoot, "manifests");
    await mkdir(manifestDir, { recursive: true });
    await writeFile(
      path.join(manifestDir, "members.yaml"),
      [
        "title: 核心成员",
        "items:",
        "  - id: mom",
        "    title: 妈妈",
        "    sourcePath: _knowledge/members/mom.md",
      ].join("\n"),
      "utf8",
    );
    vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
    vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);

    await expect(loadDomainManifest("members")).resolves.toEqual({
      title: "核心成员",
      description: "成员档案与角色线索",
      focus: [],
      nextActions: [],
      links: [],
      items: [
        {
          id: "mom",
          title: "妈妈",
          sourcePath: "_knowledge/members/mom.md",
        },
      ],
    });
  });
});
