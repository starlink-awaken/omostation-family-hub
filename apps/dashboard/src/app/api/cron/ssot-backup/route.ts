import { NextResponse } from "next/server";

import { authenticateCron } from "@/lib/cron-auth";
import { createDocumentsSnapshotReceipt } from "@/lib/state-snapshot";

export async function GET(request: Request) {
  const auth = authenticateCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    return NextResponse.json(await createDocumentsSnapshotReceipt());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "快照失败" }, { status: 500 });
  }
}
