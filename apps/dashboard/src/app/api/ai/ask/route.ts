import { NextResponse } from "next/server";
import { aiChat } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const { question, context } = (await request.json()) as {
      question: string;
      context?: { title: string; excerpt: string; path: string }[];
    };

    if (!question?.trim()) {
      return NextResponse.json({ error: "缺少问题" }, { status: 400 });
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

    const answer = await aiChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);

    return NextResponse.json({ answer, context: context || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 请求失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
