import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export async function GET() {
  try {
    const fp = statePath("generated", "timeline.json");
    const raw = await readFile(fp, "utf8");
    const entries = JSON.parse(raw);
    return NextResponse.json(entries, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
