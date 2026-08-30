import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getSsotRoot, resolveSsotPath } from "@/lib/ssot";
import { extractFrontmatter, stripFrontmatter } from "@/lib/extract";
import { scannablePaths } from "@/lib/task-extractor";

export interface ReminderItem {
  id: string;
  title: string;
  date: string;
  daysLeft: number;
  sourcePath: string;
  type: "due" | "deadline" | "custom";
}

const ISO_DATE_RE = /(\d{4})-(\d{1,2})-(\d{1,2})/;
const CN_DATE_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日/;

const DUE_KEYS = /到期|due/i;
const DEADLINE_KEYS = /截止|deadline/i;

function inferType(text: string): "due" | "deadline" | "custom" {
  if (DEADLINE_KEYS.test(text)) return "deadline";
  if (DUE_KEYS.test(text)) return "due";
  return "custom";
}

function normalizeDate(y: string, m: string, d: string): string {
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function extractTitle(content: string, sourcePath: string): string {
  const fm = extractFrontmatter(content);
  if (typeof fm.title === "string" && fm.title.trim()) return fm.title.trim();
  return path.basename(sourcePath, path.extname(sourcePath));
}

export function extractRemindersFromMd(content: string, sourcePath: string): ReminderItem[] {
  const body = stripFrontmatter(content);
  const title = extractTitle(content, sourcePath);
  const lines = body.split("\n");
  const reminders: ReminderItem[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isoMatch = line.match(ISO_DATE_RE);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      const dateStr = normalizeDate(y, m, d);
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      const diff = dateObj.getTime() - now.getTime();
      const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const type = inferType(line);
      const id = `remind-${Buffer.from(sourcePath + ":" + i).toString("base64").slice(0, 12)}`;

      reminders.push({ id, title, date: dateStr, daysLeft, sourcePath, type });
    }

    const cnMatch = line.match(CN_DATE_RE);
    if (cnMatch) {
      const [, y, m, d] = cnMatch;
      const dateStr = normalizeDate(y, m, d);
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      const diff = dateObj.getTime() - now.getTime();
      const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const type = inferType(line);
      const id = `remind-${Buffer.from(sourcePath + ":" + i + ":cn").toString("base64").slice(0, 12)}`;

      reminders.push({ id, title, date: dateStr, daysLeft, sourcePath, type });
    }
  }

  return reminders;
}

async function findMdFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "_archive") continue;
      const sub = await findMdFiles(fullPath);
      results.push(...sub);
    } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".markdown"))) {
      results.push(fullPath);
    }
  }

  return results;
}

export async function extractAllReminders(): Promise<ReminderItem[]> {
  const root = getSsotRoot();
  const relPaths = scannablePaths();
  const allReminders: ReminderItem[] = [];

  for (const relPath of relPaths) {
    const absPath = resolveSsotPath(relPath);
    if (!absPath) continue;

    let mdFiles: string[];
    try {
      mdFiles = await findMdFiles(absPath);
    } catch {
      continue;
    }

    for (const fullPath of mdFiles) {
      let content: string;
      try {
        content = await readFile(fullPath, "utf-8");
      } catch {
        continue;
      }

      const relativePath = path.relative(root, fullPath);
      const reminders = extractRemindersFromMd(content, relativePath);
      allReminders.push(...reminders);
    }
  }

  return allReminders;
}
