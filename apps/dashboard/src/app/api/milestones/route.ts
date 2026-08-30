import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fp = statePath("generated", "milestones.json");
    const raw = await readFile(fp, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Milestones not available" }, { status: 503 });
  }
}
