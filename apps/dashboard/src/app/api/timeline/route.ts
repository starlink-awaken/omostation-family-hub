import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const fp = path.join(process.cwd(), "app-data", "timeline.json");
    const raw = await readFile(fp, "utf8");
    const entries = JSON.parse(raw);
    return NextResponse.json(entries, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
