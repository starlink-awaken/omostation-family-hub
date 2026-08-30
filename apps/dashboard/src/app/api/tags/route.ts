import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const raw = await readFile(path.join(process.cwd(), "app-data", "tags.json"), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ tags: {}, docs: {} });
  }
}
