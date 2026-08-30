import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const metaPath = path.join(process.cwd(), "app-data", "build-meta.json");
    const raw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(raw);
    return NextResponse.json({ ok: true, builtAt: meta.builtAt });
  } catch {
    return NextResponse.json({ ok: false, error: "data not ready" }, { status: 503 });
  }
}
