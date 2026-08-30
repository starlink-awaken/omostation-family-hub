import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { resolveSsotPath } from "@/lib/ssot";
import { statePath } from "@/lib/paths";
import { stripFrontmatter } from "@/lib/extract";

export interface HealthReminder {
  title: string;
  date: string;
  daysLeft: number;
  type: "vaccination" | "checkup" | "medication";
  memberName: string;
}

const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const CN_DATE_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;

const VACCINE_RE = /疫苗|接种|预防针/i;
const MEDICATION_RE = /用药|服药|注射|肝素|舍曲林|阿托品|激素|药物|抗生素/i;

function classifyType(line: string): "vaccination" | "checkup" | "medication" {
  if (VACCINE_RE.test(line)) return "vaccination";
  if (MEDICATION_RE.test(line)) return "medication";
  return "checkup";
}

function extractMemberName(title: string, sourcePath?: string): string {
  const known = ["Synthetic Member 01", "Synthetic Member 06", "Synthetic Member 02", "夏登峰"];
  for (const name of known) {
    if (title.includes(name)) return name;
    if (sourcePath?.includes(name)) return name;
  }
  return "未知";
}

function normalizeDate(
  yearStr: string,
  monthStr: string,
  dayStr: string,
): string {
  const y = yearStr.padStart(4, "0");
  const m = monthStr.padStart(2, "0");
  const d = dayStr.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getDueHealthReminders(): Promise<HealthReminder[]> {
  const manifestPath = statePath("manifests", "health.yaml");

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch {
    return [];
  }

  const manifest = YAML.parse(raw) as {
    items?: Array<{
      id: string;
      title: string;
      sourcePath?: string;
      sourceTitle?: string;
    }>;
  };

  if (!manifest?.items?.length) return [];

  const reminders: HealthReminder[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const item of manifest.items) {
    if (!item.sourcePath) continue;

    const resolvedPath = resolveSsotPath(item.sourcePath);
    if (!resolvedPath) continue;

    const memberName = extractMemberName(item.title, item.sourcePath);

    let content: string;
    try {
      content = await readFile(resolvedPath, "utf-8");
    } catch {
      continue;
    }

    const body = stripFrontmatter(content);
    const lines = body.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const type = classifyType(trimmed);

      ISO_DATE_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = ISO_DATE_RE.exec(trimmed)) !== null) {
        const [, y, m, d] = match;
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        const diff = dateObj.getTime() - now.getTime();
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (daysLeft <= 7) {
          reminders.push({
            title: item.sourceTitle || item.title,
            date: normalizeDate(y, m, d),
            daysLeft,
            type,
            memberName,
          });
        }
      }

      CN_DATE_RE.lastIndex = 0;
      while ((match = CN_DATE_RE.exec(trimmed)) !== null) {
        const [, y, m, d] = match;
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        const diff = dateObj.getTime() - now.getTime();
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (daysLeft <= 7) {
          reminders.push({
            title: item.sourceTitle || item.title,
            date: normalizeDate(y, m, d),
            daysLeft,
            type,
            memberName,
          });
        }
      }
    }
  }

  return reminders;
}
