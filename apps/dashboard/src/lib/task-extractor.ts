import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getSsotRoot, resolveSsotPath } from "./ssot";
import { extractFrontmatter, stripFrontmatter } from "./extract";

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  sourcePath: string;
  sourceTitle: string;
  domain: string;
  dueDate?: string;
}

const DOMAIN_MAP: Record<string, string> = {
  "01.医疗健康": "医疗",
  "02.财务状况": "财务",
  "03.育儿成长": "育儿",
  "04.家庭日常": "日常",
  "05.居家事务": "居家",
  "06.保险法律": "保险法律",
  "07.学习成长": "学习",
  "08.社会关系": "社交",
};

function inferDomain(sourcePath: string): string {
  const segments = sourcePath.split("/");
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === "_knowledge" && DOMAIN_MAP[segments[i + 1]]) {
      return DOMAIN_MAP[segments[i + 1]];
    }
  }
  if (segments[0] === "_entities") return "实体";
  if (segments[0] === "_storage") {
    if (segments[1] === "inbox") return "收件箱";
    if (segments[1] === "99-中转") return "中转";
    return segments[1] || "存储";
  }
  return segments[1] || segments[0] || "未分类";
}

function extractTitle(content: string, sourcePath: string): string {
  const fm = extractFrontmatter(content);
  if (typeof fm.title === "string" && fm.title.trim()) return fm.title.trim();
  return path.basename(sourcePath, path.extname(sourcePath));
}

const CHECKBOX_PATTERN = /^[-*]\s+\[([ x])\]\s+(.+)/;

function extractDueDate(text: string): string | undefined {
  const match = text.match(/到期[：:]\s*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : undefined;
}

export function extractTasksFromMd(content: string, sourcePath: string): TaskItem[] {
  const body = stripFrontmatter(content);
  const sourceTitle = extractTitle(content, sourcePath);
  const domain = inferDomain(sourcePath);
  const lines = body.split("\n");
  const tasks: TaskItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(CHECKBOX_PATTERN);
    if (!match) continue;

    const done = match[1] === "x";
    const text = match[2].trim();
    const dueDate = extractDueDate(text);
    const id = `task-${createHash("sha256").update(sourcePath + ":" + i).digest("hex").slice(0, 12)}`;
    const item: TaskItem = { id, text, done, sourcePath, sourceTitle, domain };
    if (dueDate) item.dueDate = dueDate;
    tasks.push(item);
  }

  return tasks;
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

export async function extractAllTasks(): Promise<TaskItem[]> {
  const root = getSsotRoot();
  const relPaths = scannablePaths();
  const allTasks: TaskItem[] = [];

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
      const tasks = extractTasksFromMd(content, relativePath);
      allTasks.push(...tasks);
    }
  }

  return allTasks;
}

export function scannablePaths(): string[] {
  return ["_knowledge/", "_entities/", "_storage/inbox/", "_storage/99-中转/"];
}
