import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getSsotRoot } from "@/lib/ssot";
import { extractFrontmatter } from "@/lib/extract";

const STALE_DAYS = 30;
const SCAN_DIRS = ["_knowledge", "_control", "_archive", "_meta", "_entities"];
const MIN_FM_FIELDS = ["status", "type", "created"];

type FileReport = {
  path: string;
  size: number;
  hasFrontmatter: boolean;
  missingFields: string[];
  staleDays: number | null;
  brokenLinks: string[];
  error?: string;
};

type HealthReport = {
  generatedAt: string;
  scanScope: string;
  totalFiles: number;
  healthy: number;
  warnings: number;
  issues: number;
  grade: "A" | "B" | "C" | "D";
  details: {
    noFrontmatter: FileReport[];
    staleFiles: FileReport[];
    missingFields: FileReport[];
    brokenLinks: FileReport[];
    readErrors: FileReport[];
  };
  topSuggestions: string[];
  brokenLinkCount: number;
};

const INTERNAL_LINK_RE = /\[([^\]]+)\]\(([^)]+\.md[^)]*)\)/g;
const WIKI_LINK_RE = /\[\[([^\]]+\.md[^|]*?)(?:\|([^\]]*))?\]\]/g;
const SSOT_DIR_PREFIXES = ["_knowledge", "_control", "_archive", "_meta", "_entities"];

let _knownMdFiles: Set<string> | null = null;

async function scanAllMdFiles(root: string): Promise<Set<string>> {
  if (_knownMdFiles) return _knownMdFiles;
  const result = new Set<string>();
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.endsWith(".md")) {
        result.add(full);
      }
    }
  }
  for (const dir of SCAN_DIRS) {
    const full = path.join(root, dir);
    try {
      await readdir(full);
      await walk(full);
    } catch {}
  }
  _knownMdFiles = result;
  return result;
}

function normalizeLinkPath(rawHref: string): string | null {
  let href = rawHref.trim();
  const qIdx = href.indexOf("?");
  if (qIdx !== -1) href = href.slice(0, qIdx);
  const hashIdx = href.indexOf("#");
  if (hashIdx !== -1) href = href.slice(0, hashIdx);
  if (!href.endsWith(".md")) return null;
  if (href.startsWith("/")) href = href.slice(1);
  return href;
}

function resolveBrokenLink(href: string, root: string): string | null {
  const norm = normalizeLinkPath(href);
  if (!norm) return null;
  const candidates = [
    path.resolve(root, norm),
    path.resolve(root, "_knowledge", norm),
    path.resolve(root, "_control", norm),
    path.resolve(root, "_archive", norm),
  ];
  for (const c of candidates) {
    if (_knownMdFiles?.has(c)) return null;
  }
  return norm;
}

export async function GET() {
  const ssotRoot = getSsotRoot();

  await scanAllMdFiles(ssotRoot);

  const allFiles: FileReport[] = [];
  const now = Date.now();
  const dayMs = 86_400_000;

  for (const absPath of _knownMdFiles ?? []) {
    const relPath = path.relative(ssotRoot, absPath);
    let content: string;
    try {
      content = await readFile(absPath, "utf8");
    } catch (e) {
      allFiles.push({
        path: relPath,
        size: 0,
        hasFrontmatter: false,
        missingFields: [],
        staleDays: null,
        brokenLinks: [],
        error: `read error: ${e instanceof Error ? e.message : "unknown"}`,
      });
      continue;
    }

    const fm = extractFrontmatter(content);
    const hasFrontmatter = Object.keys(fm).length > 0;
    const missingFields: string[] = [];
    for (const field of MIN_FM_FIELDS) {
      if (!fm[field]) missingFields.push(field);
    }

    let staleDays: number | null = null;
    if (fm["last-reviewed"]) {
      const lrStr = String(fm["last-reviewed"]);
      const lr = new Date(lrStr).getTime();
      if (!isNaN(lr)) {
        staleDays = Math.floor((now - lr) / dayMs);
      }
    }

    const brokenLinks: string[] = [];
    if (hasFrontmatter) {
      let m: RegExpExecArray | null;
      INTERNAL_LINK_RE.lastIndex = 0;
      while ((m = INTERNAL_LINK_RE.exec(content)) !== null) {
        const broken = resolveBrokenLink(m[2], ssotRoot);
        if (broken) brokenLinks.push(broken);
      }
      WIKI_LINK_RE.lastIndex = 0;
      while ((m = WIKI_LINK_RE.exec(content)) !== null) {
        const broken = resolveBrokenLink(m[1], ssotRoot);
        if (broken) brokenLinks.push(broken);
      }
    }

    allFiles.push({
      path: relPath,
      size: Buffer.byteLength(content, "utf8"),
      hasFrontmatter,
      missingFields: hasFrontmatter ? missingFields : [],
      staleDays,
      brokenLinks: [...new Set(brokenLinks)],
    });
  }

  const noFrontmatter = allFiles.filter((f) => !f.hasFrontmatter && !f.error);
  const staleFiles = allFiles.filter(
    (f) => f.staleDays !== null && f.staleDays > STALE_DAYS && !f.error,
  );
  const missingFields = allFiles.filter((f) => f.missingFields.length > 0 && !f.error);
  const brokenLinks = allFiles.filter((f) => f.brokenLinks.length > 0 && !f.error);
  const readErrors = allFiles.filter((f) => f.error);

  const totalIssues =
    noFrontmatter.length + staleFiles.length + missingFields.length + brokenLinks.length + readErrors.length;

  const totalFiles = allFiles.length;
  const healthyCount = totalFiles - totalIssues;

  let grade: "A" | "B" | "C" | "D" = "A";
  const issueRatio = totalIssues / Math.max(totalFiles, 1);
  if (issueRatio > 0.3) grade = "D";
  else if (issueRatio > 0.15) grade = "C";
  else if (issueRatio > 0.05) grade = "B";

  const suggestions: string[] = [];
  if (noFrontmatter.length > 0) suggestions.push(`${noFrontmatter.length} 个文件缺少 frontmatter，建议补充 title/status/type/created`);
  if (staleFiles.length > 0) suggestions.push(`${staleFiles.length} 个文件超过 ${STALE_DAYS} 天未 review`);
  if (missingFields.length > 0) suggestions.push(`${missingFields.length} 个文件 frontmatter 缺字段`);
  const totalBrokenLinks = brokenLinks.reduce((s, f) => s + f.brokenLinks.length, 0);
  if (totalBrokenLinks > 0) suggestions.push(`${totalBrokenLinks} 个内部链接指向不存在的文件`);
  if (grade === "A") suggestions.push("SSOT 状态良好，无需特别处理");

  const report: HealthReport = {
    generatedAt: new Date().toISOString(),
    scanScope: SCAN_DIRS.join(", "),
    totalFiles,
    healthy: healthyCount,
    warnings: staleFiles.length + missingFields.length,
    issues: totalIssues,
    grade,
    details: {
      noFrontmatter,
      staleFiles,
      missingFields,
      brokenLinks,
      readErrors,
    },
    topSuggestions: suggestions.slice(0, 5),
    brokenLinkCount: totalBrokenLinks,
  };

  return NextResponse.json(report);
}
