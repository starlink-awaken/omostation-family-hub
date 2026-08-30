import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import YAML from "yaml";
import { extractFrontmatter, normalizeInlineText, stripFrontmatter } from "../../src/lib/extract";
import { redactText } from "../../src/lib/redact";
import { ssotPath } from "../../src/lib/ssot";
import { statePath } from "../../src/lib/paths";
import type { Item } from "../../src/types/common";

export type BuilderResult = {
  name: string;
  ok: boolean;
  file?: string;
  error?: string;
  elapsedMs: number;
};

type SchemaValidator = (data: unknown) => void;

const schemaValidators = new Map<string, SchemaValidator>();

export function registerSchemaValidator(name: string, validator: SchemaValidator): void {
  schemaValidators.set(name, validator);
}

export async function verifyJson<T>(filePath: string, validator?: SchemaValidator): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  const data = JSON.parse(raw) as T;
  if (validator) {
    validator(data);
  }
}

export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  file?: string,
): Promise<[T, BuilderResult]> {
  const start = performance.now();
  try {
    const result = await fn();
    const elapsedMs = Math.round(performance.now() - start);
    return [result, { name, ok: true, file, elapsedMs }];
  } catch (e) {
    const elapsedMs = Math.round(performance.now() - start);
    const error = e instanceof Error ? e.message : String(e);
    console.warn(`build:data ${name} FAILED: ${error}`);
    return [undefined as unknown as T, { name, ok: false, error, elapsedMs }];
  }
}

export function printSummary(results: BuilderResult[]): void {
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const totalMs = results.reduce((s, r) => s + r.elapsedMs, 0);
  console.log("\n═══════════════════════════════════════");
  console.log(" 构建结果汇总");
  console.log("───────────────────────────────────────");
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const time = `${r.elapsedMs}ms`.padStart(7);
    const file = r.file ? ` → ${r.file}` : "";
    const err = r.error ? `  (${r.error.slice(0, 80)})` : "";
    console.log(`  ${icon} ${time}  ${r.name}${file}${err}`);
  }
  console.log("───────────────────────────────────────");
  console.log(`  总计: ${results.length} | ✓ ${okCount} | ✗ ${failCount} | ${totalMs}ms`);
  if (failCount > 0) {
    console.log("  失败:");
    for (const r of results) {
      if (!r.ok) console.log(`    ${r.name}: ${r.error?.slice(0, 120)}`);
    }
  }
  console.log("═══════════════════════════════════════\n");
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function encodeDocHref(href: string): string {
  if (!href.startsWith("/doc?")) return href;
  const idx = href.indexOf("?");
  if (idx === -1) return href;
  const params = new URLSearchParams(href.slice(idx + 1));
  const pathVal = params.get("path");
  if (!pathVal) return href;
  return `/doc?path=${encodeURIComponent(pathVal)}`;
}

export async function readSsotFile(relativePath: string): Promise<string> {
  return readFile(ssotPath(relativePath), "utf8");
}

export async function loadRawYaml<T>(fileName: string): Promise<Partial<T>> {
  const manifestPath = statePath("manifests", fileName);
  const raw = await readFile(manifestPath, "utf8");
  return (YAML.parse(raw) as Partial<T>) ?? {};
}

export function parseCurrentStatus(statusMd: string): string {
  return statusMd.match(/## 当前状态：([A-Z_]+)/u)?.[1] ?? "UNKNOWN";
}

export function parseCurrentPhase(stateMd: string): string {
  return (
    stateMd.match(/\|\s*当前阶段\s*\|\s*\*\*(.+?)\*\*.*\|/u)?.[1]?.trim() ??
    "UNKNOWN"
  );
}

export function parseLastReviewed(stateMd: string): string {
  const frontmatter = extractFrontmatter(stateMd);
  return typeof frontmatter["last-reviewed"] === "string"
    ? frontmatter["last-reviewed"]
    : "";
}

export function toTextSummary(text: string, maxLen = 96): string | undefined {
  const cleaned = normalizeInlineText(text);
  const redacted = redactText(cleaned, maxLen).text;
  return redacted || undefined;
}

export function toSafeTitle(
  text: string,
  fallback: string,
  maxLen = 40,
): string {
  const result = redactText(text, maxLen);
  return result.redacted ? fallback : result.text;
}

export function toItemId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

export function parseSignalItems(signalsMd: string, scope?: string): Item[] {
  const frontmatter = extractFrontmatter(signalsMd);
  const signals = Array.isArray(frontmatter.signals)
    ? (frontmatter.signals as Array<Record<string, unknown>>)
    : [];

  const filtered = scope
    ? signals.filter((s) => {
        const scopes = s.scope;
        return Array.isArray(scopes) && scopes.includes(scope);
      })
    : signals;

  return filtered.slice(0, 3).map((signal, index) => {
    const message =
      typeof signal.message === "string" ? signal.message.trim() : "";
    const type = typeof signal.type === "string" ? signal.type.trim() : "ℹ️";
    const ts = typeof signal.ts === "string" ? signal.ts : undefined;

    return {
      id: toItemId("signal", index),
      title: `${type} ${message.slice(0, 24)}`.trim(),
      summary: toTextSummary(message, 120),
      sourcePath: "_control/signals.md",
      updatedAt: ts,
      sensitivity: "private",
    };
  });
}

export function parseTimelineItems(timelineMd: string): Item[] {
  const lines = stripFrontmatter(timelineMd).split("\n");
  const items: Item[] = [];
  let inCurrentYear = false;

  for (const line of lines) {
    if (line.startsWith("## 2026 年")) {
      inCurrentYear = true;
      continue;
    }

    if (inCurrentYear && line.startsWith("## ")) {
      break;
    }

    if (!inCurrentYear || !line.startsWith("|")) {
      continue;
    }

    const cells = line
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    if (cells.length < 5 || !/^\d{4}-\d{2}-\d{2}$/u.test(cells[0])) {
      continue;
    }

    items.push({
      id: toItemId("timeline", items.length),
      title: toSafeTitle(normalizeInlineText(cells[1]), `${cells[3]}更新`),
      summary: toTextSummary(`${cells[2]} · ${cells[3]}`, 120),
      sourcePath: "_control/TIMELINE.md",
      sourceTitle: cells[4],
      updatedAt: cells[0],
      sensitivity: "private",
    });

    if (items.length >= 3) {
      break;
    }
  }

  return items;
}

export function extractMemberName(title: string): string {
  const cleaned = title.replace(/医疗汇总$/, "").trim();
  return cleaned || title;
}

export function getAvatarChar(name: string): string {
  for (const ch of name) {
    if (/[\u4e00-\u9fff]/u.test(ch)) return ch;
  }
  return name.charAt(0);
}

export function getTagline(name: string): string {
  if (name.includes("Synthetic Member 02")) return "儿童健康与成长观察";
  if (name.includes("Synthetic Member 06")) return "孕产档案与再孕前准备";
  if (name.includes("Synthetic Member 01")) return "成人健康与排查节奏";
  return "健康档案";
}

export function getMemberStatus(name: string): { label: string; variant: "warning" | "primary" | "info" } {
  if (name.includes("Synthetic Member 02")) return { label: "持续观察", variant: "warning" };
  if (name.includes("Synthetic Member 01")) return { label: "优先排查", variant: "primary" };
  if (name.includes("Synthetic Member 06")) return { label: "平稳维护", variant: "info" };
  return { label: "常规", variant: "primary" };
}
