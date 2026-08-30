import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { aiEmbed } from "@/lib/ai";
import { scoreDoc, cosineSimilarity } from "@/lib/search";
import type { SearchDoc } from "@/lib/search";

export async function POST(request: Request) {
  try {
    const { query, limit = 20 } = (await request.json()) as {
      query?: string;
      limit?: number;
    };

    if (!query?.trim()) {
      return NextResponse.json({ error: "缺少关键词" }, { status: 400 });
    }

    const raw = await readFile(
      path.join(process.cwd(), "app-data", "search-index.json"),
      "utf8"
    );
    const docs: SearchDoc[] = JSON.parse(raw);

    type SearchResult = {
      doc: SearchDoc;
      score: number;
    };

    let results: SearchResult[];

    try {
      const [queryEmbed] = await aiEmbed([query]);

      let embeddings: number[][] = [];
      try {
        const embRaw = await readFile(
          path.join(process.cwd(), "app-data", "search-embeddings.json"),
          "utf8"
        );
        embeddings = JSON.parse(embRaw);
      } catch {}

      const withScores = docs.map((doc, i) => ({
        doc,
        keywordScore: scoreDoc(doc, query),
        semanticScore: embeddings[i] ? cosineSimilarity(queryEmbed, embeddings[i]) : 0,
      }));

      results = withScores
        .filter((r) => r.keywordScore > 0 || r.semanticScore > 0.25)
        .map((r) => ({
          doc: r.doc,
          score: r.keywordScore + Math.max(0, r.semanticScore) * 50,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch {
      results = docs
        .map((doc) => ({ doc, score: scoreDoc(doc, query) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.doc.id,
        title: r.doc.title,
        path: r.doc.path,
        excerpt: r.doc.excerpt,
        text: r.doc.text,
        tags: r.doc.tags,
        score: Math.round(r.score * 10) / 10,
      })),
      total: results.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "搜索失败" },
      { status: 500 }
    );
  }
}
