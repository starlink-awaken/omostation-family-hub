import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push";

export async function GET() {
  try {
    await sendPush("🔔 家庭驾驶舱测试", "推送已就绪 ✅");
    return NextResponse.json({ ok: true, pushed: true });
  } catch {
    return NextResponse.json({ ok: false, error: "推送失败" }, { status: 500 });
  }
}
