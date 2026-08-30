import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveSsotPath } from "@/lib/ssot";
import { extractFrontmatter, extractSummaryFromMarkdown, stripFrontmatter } from "@/lib/extract";

export type SummarizeResult = {
  path: string;
  title: string;
  summary: string;
  tags: string[];
  wordCount: number;
  headings: string[];
  frontmatter: Record<string, unknown>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docPath = searchParams.get("path");

  if (!docPath) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  const resolved = resolveSsotPath(docPath);
  if (!resolved) {
    return NextResponse.json({ error: "invalid path" }, { status: 404 });
  }

  try {
    const raw = await readFile(resolved, "utf8");
    const frontmatter = extractFrontmatter(raw);
    const body = stripFrontmatter(raw);
    const headings = body
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.replace(/^##\s+/, "").trim());

    const summary = extractSummaryFromMarkdown(raw, 240) || "暂无摘要";
    const title =
      (typeof frontmatter.title === "string" ? frontmatter.title : "") ||
      path.basename(docPath).replace(/\.md$/, "");
    const tags = Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : [];

    const result: SummarizeResult = {
      path: docPath,
      title,
      summary,
      tags,
      wordCount: body.split(/\s+/).filter(Boolean).length,
      headings,
      frontmatter,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
