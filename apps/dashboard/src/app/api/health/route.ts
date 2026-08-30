import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export async function GET() {
  try {
    const metaPath = statePath("generated", "build-meta.json");
    const raw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(raw);
    return NextResponse.json({ ok: true, builtAt: meta.builtAt });
  } catch {
    return NextResponse.json({ ok: false, error: "data not ready" }, { status: 503 });
  }
}
