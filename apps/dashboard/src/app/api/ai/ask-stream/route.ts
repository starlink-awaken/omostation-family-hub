import { aiStreamChat } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const { question, context } = (await request.json()) as {
      question: string;
      context?: { title: string; excerpt: string; path: string }[];
    };

    if (!question?.trim()) {
      return new Response("缺少问题", { status: 400 });
    }

    let systemPrompt = `你是家庭驾驶舱的 AI 助手，帮助用户从家庭知识库中查找信息。
请基于提供的参考内容回答用户问题。
如果参考内容不足以回答，如实说不知道，不要编造。
回答要简洁、准确、中文。`;

    let userMessage = question;

    if (context && context.length > 0) {
      const ctxText = context
        .map(
          (c, i) =>
            `[${i + 1}] ${c.title}\n路径: ${c.path}\n内容摘要: ${c.excerpt}`
        )
        .join("\n\n");

      systemPrompt = `你是家庭驾驶舱的 AI 助手，帮助用户从家庭知识库中查找信息。
请严格基于以下参考文档回答问题。引用时标注来源编号 [1][2] 等。
如果参考内容不足以回答，如实说不知道。回答要简洁、准确、中文。`;

      userMessage = `## 参考文档\n\n${ctxText}\n\n## 用户问题\n\n${question}`;
    }

    const streamRes = await aiStreamChat([
      { role: "system", content: systemPrompt },
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
