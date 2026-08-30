import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export async function GET() {
  try {
    const index = statePath("generated", "search-index.json");
    const raw = await readFile(index, "utf8");
    return new NextResponse(raw, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "索引未就绪" }, { status: 503 });
  }
}
