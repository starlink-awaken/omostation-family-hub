import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fp = path.join(process.cwd(), "app-data", "milestones.json");
    const raw = await readFile(fp, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Milestones not available" }, { status: 503 });
  }
}
