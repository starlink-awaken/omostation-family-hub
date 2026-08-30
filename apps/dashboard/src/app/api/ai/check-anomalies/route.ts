import { NextResponse } from "next/server";
import { checkAnomalies } from "@/lib/anomaly-detector";

export async function GET() {
  try {
    const anomalies = await checkAnomalies();
    return NextResponse.json({ anomalies });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "检查异常失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
