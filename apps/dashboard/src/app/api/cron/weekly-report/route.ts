import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { authenticateCron } from "@/lib/cron-auth";
import { statePath } from "@/lib/paths";

export async function GET(request: Request) {
  const auth = authenticateCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const appData = statePath("generated");
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const weekStr = `${weekAgo.toISOString().slice(0, 10)} ~ ${today.toISOString().slice(0, 10)}`;

  let buildAt = "";
  try {
    const meta = JSON.parse(await readFile(path.join(appData, "build-meta.json"), "utf8"));
    buildAt = meta.builtAt?.slice(0, 10) || "";
  } catch {}

  let signalCount = 0;
  let taskCount = 0;
  let healthCount = 0;
  try {
    const summary = JSON.parse(await readFile(path.join(appData, "summary.json"), "utf8"));
    signalCount = summary.signals?.length || 0;
  } catch {}
  try {
    const tasks = JSON.parse(await readFile(path.join(appData, "tasks.json"), "utf8"));
    taskCount = tasks.tasks?.length || tasks.items?.length || 0;
  } catch {}
  try {
    const health = JSON.parse(await readFile(path.join(appData, "health.json"), "utf8"));
    if (health.healthSections?.members) {
      healthCount = health.healthSections.members.length;
    }
  } catch {}

  const lines = [
    `📋 家庭周报 | ${weekStr}`,
    "",
    ...(buildAt ? [`📅 数据版本：${buildAt}`] : []),
    ...(signalCount > 0 ? [`🔔 本周信号：${signalCount} 条`] : []),
    ...(taskCount > 0 ? [`✅ 待办事项：${taskCount} 项`] : []),
    ...(healthCount > 0 ? [`🩺 健康关注：${healthCount} 位成员`] : []),
    "",
    "打开驾驶舱查看更多：",
  ];

  const barkKey = process.env.BARK_API_KEY;
  if (barkKey) {
    const barkUrl = `https://api.day.app/${barkKey}/${encodeURIComponent(lines.slice(0, 5).join("\n"))}`;
    try {
      await fetch(barkUrl, { signal: AbortSignal.timeout(5000) });
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    week: weekStr,
    summary: { signals: signalCount, tasks: taskCount, healthMembers: healthCount },
    generatedAt: new Date().toISOString(),
  });
}
