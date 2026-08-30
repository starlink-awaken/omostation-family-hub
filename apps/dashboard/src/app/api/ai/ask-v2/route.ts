import { readFile, writeFile } from "node:fs/promises";
import { aiStreamChat, aiEmbed } from "@/lib/ai";
import type { SearchChunk } from "@/lib/search";
import { scoreChunk, cosineSimilarity } from "@/lib/search";
import { statePath } from "@/lib/paths";

export async function POST(request: Request) {
  try {
    const { question } = (await request.json()) as { question?: string };

    if (!question?.trim()) {
      return new Response("缺少问题", { status: 400 });
    }

    const chunksRaw = await readFile(
      statePath("generated", "search-chunks.json"),
      "utf8"
    );
    const chunks: SearchChunk[] = JSON.parse(chunksRaw);

    let chunkEmbeddings: number[][] | null = null;
    const embPath = statePath("cache", "search-chunks-embeddings.json");
    try {
      const embRaw = await readFile(embPath, "utf8");
      chunkEmbeddings = JSON.parse(embRaw);
    } catch {
      // Lazy: generate embeddings on first ask if missing
      try {
        const chunksRaw = await readFile(
          statePath("generated", "search-chunks.json"),
          "utf8"
        );
        const chunks: SearchChunk[] = JSON.parse(chunksRaw);
        const texts = chunks.map((c) => c.text);
        const embeddings = await aiEmbed(texts);
        await writeFile(embPath, JSON.stringify(embeddings) + "\n", "utf8");
        chunkEmbeddings = embeddings;
        console.log(`ask-v2: lazy-generated ${embeddings.length} chunk embeddings`);
      } catch (e2) {
        console.warn("ask-v2: lazy embedding failed, using keyword-only", e2 instanceof Error ? e2.message : "");
      }
    }

    let topChunks: { chunk: SearchChunk; score: number; semanticScore: number }[];

    if (chunkEmbeddings) {
      let queryEmbed: number[] | null = null;
      try {
        [queryEmbed] = await aiEmbed([question]);
      } catch {}

      if (queryEmbed) {
        const scored = chunks.map((chunk, i) => {
          const kw = scoreChunk(chunk, question);
          let sem = 0;
          if (chunkEmbeddings[i]) {
            sem = Math.max(0, cosineSimilarity(queryEmbed, chunkEmbeddings[i]));
          }
          return { chunk, score: kw + sem * 50, semanticScore: sem };
        });
        topChunks = scored
          .filter((r) => r.score > 0 || r.semanticScore > 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);
      } else {
        topChunks = keywordFallback(chunks, question);
      }
    } else {
      topChunks = keywordFallback(chunks, question);
    }

    const contextText = topChunks
      .map(
        (r, i) =>
          `[${i + 1}] ${r.chunk.docTitle} — ${r.chunk.chunkHeading}\n路径: ${r.chunk.path}\n内容:\n${r.chunk.text}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `你是家庭驾驶舱的 AI 助手。请严格基于以下参考文档的片段回答用户的问题。

要求：
- 引用来源时标注编号 [1][2] 等，格式为「文档标题 — 章节标题」
- 如果参考内容不足以回答，如实说不知道
- 回答简洁、准确，中文
- 可以适当结合多条文档片段进行综合回答`;

    const userMessage = contextText
      ? `## 参考文档片段\n\n${contextText}\n\n## 用户问题\n\n${question}`
      : question;

    const fallbackPrompt = `你是家庭驾驶舱的 AI 助手。请回答用户的问题。
如果不知道答案，就如实说不知道。回答简洁、准确，中文。`;

    const streamRes = await aiStreamChat([
      { role: "system", content: topChunks.length > 0 ? systemPrompt : fallbackPrompt },
      { role: "user", content: userMessage },
    ]);

    const reader = streamRes.body?.getReader();
    if (!reader) throw new Error("No stream body");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
            for (const line of lines) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta || {};
                const text = delta.content || delta.reasoning_content || "";
                if (text) controller.enqueue(encoder.encode(text));
              } catch {}
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 请求失败";
    return new Response(message, { status: 500 });
  }
}

function keywordFallback(chunks: SearchChunk[], question: string) {
  const scored = chunks.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, question),
    semanticScore: 0,
  }));
  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
