import { NextResponse } from "next/server";
import { authenticateCron } from "@/lib/cron-auth";
import { getDueHealthReminders } from "@/lib/health-check";
import { sendPush } from "@/lib/push";

export async function GET(request: Request) {
  const auth = authenticateCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const reminders = await getDueHealthReminders();

    if (reminders.length === 0) {
      return NextResponse.json({ ok: true, reminders: 0, pushed: false });
    }

    const lines = reminders.map(
      (r) => `${r.title}（${r.daysLeft <= 0 ? "已过期" : `还剩${r.daysLeft}天`}）`
    );
    const title = "🏥 健康提醒";
    const body = lines.join("\n");

    await sendPush(title, body);

    return NextResponse.json({
      ok: true,
      reminders: reminders.length,
      pushed: true,
      pushedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "健康检测失败" }, { status: 500 });
  }
}
