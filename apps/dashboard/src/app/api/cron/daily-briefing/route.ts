import { NextResponse } from "next/server";
import { authenticateCron } from "@/lib/cron-auth";
import { generateDailyBriefing } from "@/lib/daily-briefing";
import { sendPush } from "@/lib/push";

export async function GET(request: Request) {
  const auth = authenticateCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const briefing = await generateDailyBriefing();
    await sendPush("☀️ 家庭晨报", briefing.text);

    return NextResponse.json({
      ok: true,
      pushedAt: new Date().toISOString(),
      text: briefing.text,
    });
  } catch {
    return NextResponse.json({ error: "生成简报失败" }, { status: 500 });
  }
}
