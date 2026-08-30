import { readFile } from "node:fs/promises";
import { ssotPath } from "@/lib/ssot";
import { extractFrontmatter, stripFrontmatter, normalizeInlineText } from "@/lib/extract";
import { redactText } from "@/lib/redact";

export interface Item {
  link: string;
  highlighted: boolean;
  title: string;
  summary: string;
  date: string;
  domain: string;
  related: string;
  type: string;
}

export type TimelineEntry = {
  date: string;
  event: string;
  type: string;
  domain?: string;
  related?: string;
};

function toTextSummary(text: string, maxLen = 96): string | undefined {
  const cleaned = normalizeInlineText(text);
  const redacted = redactText(cleaned, maxLen).text;
  return redacted || undefined;
}

function toSafeTitle(
  text: string,
  fallback: string,
  maxLen = 40,
): string {
  const result = redactText(text, maxLen);
  return result.redacted ? fallback : result.text;
}

export async function parseTimelineItems(): Promise<Item[]> {
  const raw = await readFile(ssotPath("_control/TIMELINE.md"), "utf8");
  const lines = stripFrontmatter(raw).split("\n");
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
      link: "_control/TIMELINE.md",
      highlighted: false,
      title: toSafeTitle(normalizeInlineText(cells[1]), `${cells[3]}更新`),
      summary: toTextSummary(`${cells[2]} · ${cells[3]}`, 120) ?? "",
      date: cells[0],
      domain: cells[2],
      related: cells[3],
      type: cells[4],
    });

    if (items.length >= 3) {
      break;
    }
  }

  return items;
}

export async function parseLastReviewed(): Promise<string> {
  const raw = await readFile(ssotPath("_control/STATE.md"), "utf8");
  const frontmatter = extractFrontmatter(raw);
  return typeof frontmatter["last-reviewed"] === "string"
    ? frontmatter["last-reviewed"]
    : "";
}

export async function parseCurrentPhase(): Promise<string> {
  const raw = await readFile(ssotPath("_control/STATE.md"), "utf8");
  return (
    raw.match(/\|\s*当前阶段\s*\|\s*\*\*(.+?)\*\*.*\|/u)?.[1]?.trim() ??
    "UNKNOWN"
  );
}

export async function parseSignalItems(): Promise<Item[]> {
  const raw = await readFile(ssotPath("_control/signals.md"), "utf8");
  const frontmatter = extractFrontmatter(raw);
  const signals = Array.isArray(frontmatter.signals)
    ? (frontmatter.signals as Array<Record<string, unknown>>)
    : [];

  return signals.slice(0, 3).map((signal) => {
    const message =
      typeof signal.message === "string" ? signal.message.trim() : "";
    const type = typeof signal.type === "string" ? signal.type.trim() : "ℹ️";
    const ts = typeof signal.ts === "string" ? signal.ts : "";

    return {
      link: "_control/signals.md",
      highlighted: false,
      title: `${type} ${message.slice(0, 24)}`.trim(),
      summary: toTextSummary(message, 120) ?? "",
      date: ts,
      domain: "",
      related: "",
      type,
    };
  });
}

export async function parseFullTimeline(): Promise<TimelineEntry[]> {
  const raw = await readFile(ssotPath("_control/TIMELINE.md"), "utf8");
  const lines = stripFrontmatter(raw).split("\n");
  const entries: TimelineEntry[] = [];
  let inDataSection = false;

  for (const line of lines) {
    if (line.startsWith("## 2026") || line.startsWith("## 2025")) {
      inDataSection = true;
      continue;
    }
    if (inDataSection && line.startsWith("## ")) break;
    if (!inDataSection || !line.startsWith("|")) continue;

    const cells = line.split("|").map((p) => p.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    if (cells[0].includes("日期") || cells[0].includes("---")) continue;
    if (!/^\d{4}/.test(cells[0])) continue;

    if (cells.length >= 5) {
      entries.push({ date: cells[0], event: cells[1], type: cells[2], domain: cells[3], related: cells[4] });
    } else {
      entries.push({ date: cells[0], event: cells[1], type: cells[2] });
    }
  }

  return entries;
}
