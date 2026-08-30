import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveSsotPath } from "@/lib/ssot";
import { stripFrontmatter } from "@/lib/extract";
import { aiChat } from "@/lib/ai";

const CACHE_DIR = path.join(process.cwd(), "app-data", ".ai-summary-cache");

function docPathToCacheKey(docPath: string): string {
  return docPath.replace(/[/\\:?&%]/g, "_").replace(/__+/g, "_").replace(/^_|_$/g, "").toLowerCase();
}

async function readCached(docPath: string): Promise<string | null> {
  try {
    const key = docPathToCacheKey(docPath);
    const fp = path.join(CACHE_DIR, `${key}.txt`);
    return await readFile(fp, "utf8");
  } catch {
    return null;
  }
}

async function writeCache(docPath: string, summary: string) {
  try {
    const key = docPathToCacheKey(docPath);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, `${key}.txt`), summary, "utf8");
  } catch {}
}

function summarizeBody(body: string, maxLen = 200): string {
  const lines = body.split("\n");
  const parts: string[] = [];
  let buf = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const bq = line.match(/^>\s*(.*)/);
    if (bq) {
      const t = bq[1].replace(/\*\*/g, "").replace(/\|/g, "/").trim();
      if (t) buf += (buf ? " · " : "") + t;
      continue;
    }

    if (line.startsWith("---") || line.startsWith("```") || line.startsWith("|||")) continue;
    if (line.startsWith("|") && line.endsWith("|")) continue;

    const text = line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "").replace(/\|/g, "/").trim();
    if (!text) continue;

    if (buf) parts.push(buf);
    buf = "";
    parts.push(text);
    if (parts.length >= 3) break;
  }
  if (buf) parts.push(buf);

  const result = parts.join(" · ");
  return result.length > maxLen ? result.slice(0, maxLen).replace(/\s+\S*$/, "") + "…" : result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docPath = searchParams.get("path");
  if (!docPath) return NextResponse.json({ error: "missing path" }, { status: 400 });

  const resolved = resolveSsotPath(docPath);
  if (!resolved) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const raw = await readFile(resolved, "utf8");
    const body = stripFrontmatter(raw).trim();
    const wordCount = body.split(/\s+/).filter(Boolean).length;
    const contentPreview = body.slice(0, 3000);

    const headings = body
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.replace(/^##\s+/, "").trim());

    const cached = await readCached(docPath);
    if (cached) {
      return NextResponse.json({ summary: cached, wordCount, headings, fromCache: true });
    }

    const textFallback = summarizeBody(body);

    const summary = await Promise.race([
      aiChat([
        {
          role: "system",
          content: `为以下文档生成一段简洁的中文摘要（50-100字）。直接给出摘要，不加套话。`,
        },
        { role: "user", content: contentPreview },
      ], { temperature: 0.2 }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 30000)
      ),
    ]).then((r) => {
      if (r && r.trim()) {
        writeCache(docPath, r.trim());
        return r.trim();
      }
      return textFallback;
    }).catch(() => textFallback);

    return NextResponse.json({ summary, wordCount, headings, fromCache: false });
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
