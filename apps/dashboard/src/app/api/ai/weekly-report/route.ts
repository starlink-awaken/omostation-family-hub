import { readFile } from "node:fs/promises";
import path from "node:path";
import { aiStreamChat } from "@/lib/ai";

export async function GET() {
  try {
    const cwd = process.cwd();

    let timeline: { date: string; event: string; type: string }[] = [];
    let healthSummary = "";
    let growthInfo = "";
    let recentTitles: string[] = [];

    try {
      const raw = await readFile(path.join(cwd, "app-data", "timeline.json"), "utf8");
      timeline = JSON.parse(raw);
    } catch {}

    try {
      const raw = await readFile(path.join(cwd, "app-data", "health.json"), "utf8");
      const data = JSON.parse(raw);
      healthSummary = (data.healthSections?.overviewSummary || "").slice(0, 300);
    } catch {}

    try {
      const raw = await readFile(path.join(cwd, "app-data", "growth.json"), "utf8");
      const data = JSON.parse(raw);
      const gs = data.growthSections || {};
      growthInfo = [
        gs.heroSummaries?.[0]?.value || "",
        gs.heroSummaries?.[1]?.value || "",
        gs.heroSummaries?.[1]?.subtitle || "",
      ].filter(Boolean).join(" · ");
    } catch {}

    try {
      const raw = await readFile(path.join(cwd, "app-data", "summary.json"), "utf8");
      const data = JSON.parse(raw);
      recentTitles = (data.recentUpdates || []).map((d: { title: string }) => d.title).slice(0, 5);
    } catch {}

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekEvents = timeline
      .filter((e) => new Date(e.date) >= weekAgo)
      .slice(0, 15);

    const today = new Date().toISOString().slice(0, 10);

    const prompt = `你是一个家庭助理，请根据以下数据生成一份 ${today} 的「家庭周报」，用中文 Markdown 格式输出。

## 最近 7 天时间线事件
${weekEvents.map((e) => `- ${e.date} ${e.event}`).join("\n") || "无近期事件"}

## 健康快照
${healthSummary || "暂无"}

## 育儿成长
${growthInfo || "暂无"}

## 近期文档更新
${recentTitles.map((t) => `- ${t}`).join("\n") || "暂无"}

---

请直接生成以下格式：
# 📅 家庭周报（${today}）

## 📌 本周大事
## 🏥 健康动态
## 🌱 育儿进展
## 📚 文档更新
## 💡 备忘建议`;

    const streamRes = await aiStreamChat([
      { role: "system", content: "你是一个精炼的家庭周报撰写助手。用简洁、温馨的中文输出。" },
      { role: "user", content: prompt },
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
    const message = err instanceof Error ? err.message : "生成周报失败";
    return new Response(message, { status: 500 });
  }
}
