import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { ssotPath } from "./ssot";
import { statePath } from "./paths";

const DOMAIN_DIR_MAP: Record<string, string[]> = {
  health:  ["_knowledge/02.医疗健康"],
  members: ["_knowledge/01.成员档案"],
  growth:  ["_knowledge/03.育儿成长"],
  daily:   ["_knowledge/04.家庭日常", "_archive"],
  assets:  ["_knowledge/05.资产设备"],
};

const DOMAIN_DEFAULTS: Record<string, { title: string; description: string }> = {
  members: { title: "家庭成员", description: "成员档案与角色线索" },
  health: { title: "医疗健康", description: "健康档案与提醒线索" },
  growth: { title: "育儿成长", description: "成长记录与阶段线索" },
  daily: { title: "家庭日常", description: "日常安排与协同线索" },
  assets: { title: "资产设备", description: "家庭资产与维护线索" },
};

const SUMMARY_DEFAULT_ENTRIES = {
  primary: { title: "家庭成员", href: "/members" },
  secondary: [
    { title: "医疗健康", href: "/health" },
    { title: "育儿成长", href: "/growth" },
    { title: "家庭日常", href: "/daily" },
    { title: "资产设备", href: "/assets" },
  ],
};

export type ManifestItem = {
  id: string;
  title: string;
  sourcePath: string;
  sourceTitle?: string;
};

type SummaryEntry = {
  title: string;
  href: string;
};

export type RawManifest = {
  title: string;
  description: string;
  focus?: Array<{ id: string; title: string; sourcePath: string; sourceTitle?: string }>;
  nextActions?: Array<{ id: string; title: string; sourcePath: string; sourceTitle?: string }>;
  links?: Array<{ title: string; href: string }>;
  items?: Array<{ id: string; title: string; sourcePath: string; sourceTitle?: string }>;
};

function sanitizeTitle(filename: string): string {
  return filename
    .replace(/\.md$/i, "")
    .replace(/^[\d.]+/u, "")
    .replace(/[-_]/g, " ")
    .trim() || filename;
}

function toItemId(sourcePath: string, index: number): string {
  const hash = crypto.createHash("md5").update(sourcePath).digest("hex").slice(0, 8);
  return `item-${hash}-${index}`;
}

let itemCounter = 0;

async function autoScanItems(dirPaths: string[], maxFiles = 50): Promise<ManifestItem[]> {
  const items: ManifestItem[] = [];

  async function walkDir(dirRel: string): Promise<void> {
    if (items.length >= maxFiles) return;
    const dirAbs = ssotPath(dirRel);
    let entries;
    try {
      entries = await readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (items.length >= maxFiles) break;
      if (entry.name.startsWith(".")) continue;
      const childRel = path.posix.join(dirRel.replace(/\\/g, "/"), entry.name);
      if (entry.isDirectory()) {
        await walkDir(childRel);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const title = sanitizeTitle(entry.name);
        items.push({
          id: toItemId(childRel, itemCounter++),
          title,
          sourcePath: childRel,
        });
      }
    }
  }

  for (const dirRel of dirPaths) {
    await walkDir(dirRel);
    if (items.length >= maxFiles) break;
  }
  return items;
}

export async function loadDomainManifest(domain: string): Promise<{
  title: string;
  description: string;
  focus: ManifestItem[];
  nextActions: ManifestItem[];
  links: Array<{ title: string; href: string }>;
  items: ManifestItem[];
}> {
  const defaults = DOMAIN_DEFAULTS[domain] ?? { title: domain, description: "" };
  const manifestPath = statePath("manifests", `${domain}.yaml`);
  let raw: RawManifest = { ...defaults, focus: [], nextActions: [], links: [], items: [] };
  try {
    const content = await readFile(manifestPath, "utf8");
    raw = { ...raw, ...((YAML.parse(content) as Partial<RawManifest>) ?? {}) };
  } catch {}

  const items = raw.items && raw.items.length > 0
    ? raw.items
    : await autoScanItems(DOMAIN_DIR_MAP[domain] ?? []);

  return {
    title: raw.title,
    description: raw.description,
    focus: raw.focus ?? [],
    nextActions: raw.nextActions ?? [],
    links: raw.links ?? [],
    items,
  };
}

export async function loadSummaryManifest(): Promise<{
  weekFocus: ManifestItem[];
  entries: { primary?: SummaryEntry; secondary?: SummaryEntry[] };
}> {
  const manifestPath = statePath("manifests", "summary.yaml");
  let raw: {
    summary?: { weekFocus?: ManifestItem[]; entries?: { primary?: SummaryEntry; secondary?: SummaryEntry[] } };
    weekFocus?: ManifestItem[];
    entries?: { primary?: SummaryEntry; secondary?: SummaryEntry[] };
  } = {};
  try {
    const content = await readFile(manifestPath, "utf8");
    raw = (YAML.parse(content) as Record<string, unknown>) ?? {};
  } catch {}

  const s = raw.summary ?? raw;
  return {
    weekFocus: s.weekFocus ?? [],
    entries: {
      primary: s.entries?.primary ?? SUMMARY_DEFAULT_ENTRIES.primary,
      secondary: s.entries?.secondary ?? SUMMARY_DEFAULT_ENTRIES.secondary,
    },
  };
}
