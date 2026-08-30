import { NextResponse } from "next/server";
import { authenticateCron } from "@/lib/cron-auth";
import { extractAllReminders } from "@/lib/reminder-extractor";
import { sendPush } from "@/lib/push";

export async function GET(request: Request) {
  const auth = authenticateCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const allReminders = await extractAllReminders();

    const dueReminders = allReminders.filter(
      (r) => r.daysLeft >= -1 && r.daysLeft <= 3
    );

    if (dueReminders.length === 0) {
      return NextResponse.json({ ok: true, reminders: 0, pushed: false });
    }

    const lines = dueReminders.map(
      (r) => `${r.title}（${r.daysLeft <= 0 ? "已过期" : `还剩${r.daysLeft}天`}）`
    );
    const title = "⏰ 到期提醒";
    const body = lines.join("\n");

    await sendPush(title, body);

    return NextResponse.json({
      ok: true,
      reminders: dueReminders.length,
      pushed: true,
      pushedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "到期提醒提取失败" }, { status: 500 });
  }
}
