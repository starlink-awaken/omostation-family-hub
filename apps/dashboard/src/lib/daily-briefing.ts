import { readFile } from "node:fs/promises";
import { statePath } from "@/lib/paths";
import { aiChat } from "@/lib/ai";
import { getDueHealthReminders } from "@/lib/health-check";
import { getYesterdayFinanceDigest } from "@/lib/finance-digest";
import { checkAnomalies } from "@/lib/anomaly-detector";

export interface DailyBriefing {
  text: string;
  hasData: boolean;
  generatedAt: string;
}

async function fetchWeather(): Promise<string> {
  try {
    const res = await fetch("https://wttr.in/Beijing?format=%C+%t", { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.text();
  } catch {}
  return "";
}

async function getCalendarToday(): Promise<string[]> {
  try {
    const raw = await readFile(statePath("manifests", "summary.yaml"), "utf8");
    const todayMatch = raw.match(/todayEntries:\s*\[([\s\S]*?)\]/);
    if (todayMatch) {
      return todayMatch[1]
        .split("\n")
        .map((l) => l.replace(/^\s*-\s*["']?/, "").replace(/["']?\s*$/, "").trim())
        .filter(Boolean);
    }
  } catch {}
  return [];
}

export async function generateDailyBriefing(): Promise<DailyBriefing> {
  const today = new Date().toISOString().slice(0, 10);
  const parts: string[] = [];

  const weather = await fetchWeather();
  if (weather) parts.push(`🌤 天气：${weather}`);

  const calendar = await getCalendarToday();
  if (calendar.length > 0) {
    parts.push(`📅 今日事项：${calendar.join("、")}`);
  }

  const health = await getDueHealthReminders();
  if (health.length > 0) {
    const reminders = health.map((h) => `${h.title}（${h.daysLeft <= 0 ? "已过期" : `还剩${h.daysLeft}天`}）`).join("、");
    parts.push(`🏥 健康提醒：${reminders}`);
  }

  const finance = await getYesterdayFinanceDigest();
  if (finance && finance.total > 0) {
    const cats = finance.categories.map((c) => `${c.name} ¥${c.amount}`).join("、");
    parts.push(`💰 昨日支出：¥${finance.total}（${cats}）`);
  }

  const anomalies = await checkAnomalies();
  const nonSummary = anomalies.filter((a) => a.type !== "summary");
  if (nonSummary.length > 0) {
    for (const a of nonSummary) {
      parts.push(`⚠️ ${a.title}：${a.detail}`);
    }
  }

  const rawText = parts.join("\n");
  const hasData = parts.length > 0;

  try {
    const aiText = await aiChat([
      {
        role: "system",
        content: "你是一个家庭助理。根据以下数据生成一段 80-120 字的晨间简报，用温馨自然的中文。简洁、有条理、不说废话。",
      },
      {
        role: "user",
        content: rawText || "今日无特殊事项",
      },
    ], { temperature: 0.3 });

    if (aiText && aiText.trim()) {
      return { text: aiText.trim(), hasData, generatedAt: today };
    }
  } catch {}

  const fallbackText = parts.length > 0
    ? `☀️ 早上好！${parts.join("。")}。`
    : "☀️ 早上好，今天暂无待办事项。祝有愉快的一天！";

  return { text: fallbackText, hasData, generatedAt: today };
}
