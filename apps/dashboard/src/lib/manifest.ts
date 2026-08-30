import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { ssotPath } from "./ssot";

const DOMAIN_DIR_MAP: Record<string, string[]> = {
  health:  ["_knowledge/02.医疗健康"],
  members: ["_knowledge/01.成员档案"],
  growth:  ["_knowledge/03.育儿成长"],
  daily:   ["_knowledge/04.家庭日常", "_archive"],
  assets:  ["_knowledge/05.资产设备"],
};

export type ManifestItem = {
  id: string;
  title: string;
  sourcePath: string;
  sourceTitle?: string;
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
  const manifestPath = path.join(process.cwd(), "data-manifest", `${domain}.yaml`);
  let raw: RawManifest = { title: domain, description: "", focus: [], nextActions: [], links: [], items: [] };
  try {
    const content = await readFile(manifestPath, "utf8");
    raw = (YAML.parse(content) as RawManifest) ?? raw;
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
  entries: { primary?: ManifestItem; secondary?: ManifestItem[] };
}> {
  const manifestPath = path.join(process.cwd(), "data-manifest", "summary.yaml");
  let raw: { summary?: { weekFocus?: ManifestItem[]; entries?: { primary?: ManifestItem; secondary?: ManifestItem[] } } } = {};
  try {
    const content = await readFile(manifestPath, "utf8");
    raw = (YAML.parse(content) as Record<string, unknown>) ?? {};
  } catch {}

  const s = raw.summary ?? {};
  return {
    weekFocus: s.weekFocus ?? [],
    entries: {
      primary: s.entries?.primary,
      secondary: s.entries?.secondary ?? [],
    },
  };
}
