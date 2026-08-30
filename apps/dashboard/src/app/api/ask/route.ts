import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

type SearchDoc = {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  tags: string[];
};

type AskResult = {
  query: string;
  results: {
    doc: SearchDoc;
    relevance: number;
    matchContext: string;
  }[];
};

async function loadSearchIndex(): Promise<SearchDoc[]> {
  try {
    const raw = await readFile(statePath("generated", "search-index.json"), "utf8");
    return JSON.parse(raw) as SearchDoc[];
  } catch {
    return [];
  }
}

function scoreRelevance(query: string, doc: SearchDoc): number {
  const q = query.toLowerCase();
  const title = doc.title.toLowerCase();
  const excerpt = doc.excerpt.toLowerCase();
  const tagText = doc.tags.join(" ").toLowerCase();
  let score = 0;

  if (title.includes(q)) score += 10;
  if (excerpt.includes(q)) score += 5;
  if (tagText.includes(q)) score += 3;

  const words = q.split(/\s+/);
  for (const word of words) {
    if (word.length < 2) continue;
    if (title.includes(word)) score += 3;
    if (excerpt.includes(word)) score += 2;
    if (tagText.includes(word)) score += 1;
  }

  return score;
}

function findMatchContext(excerpt: string, query: string): string {
  const q = query.toLowerCase();
  const lower = excerpt.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return excerpt.slice(0, 200);

  const start = Math.max(0, idx - 60);
  const end = Math.min(excerpt.length, idx + q.length + 120);
  let context = excerpt.slice(start, end);
  if (start > 0) context = "…" + context;
  if (end < excerpt.length) context = context + "…";
  return context;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ query: "", results: [] });
  }

  const docs = await loadSearchIndex();
  const scored = docs
    .map((doc) => ({
      doc,
      relevance: scoreRelevance(query, doc),
      matchContext: findMatchContext(doc.excerpt, query),
    }))
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);

  const result: AskResult = { query, results: scored };
  return NextResponse.json(result);
}
