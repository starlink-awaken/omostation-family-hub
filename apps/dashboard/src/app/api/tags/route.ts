import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export async function GET() {
  try {
    const raw = await readFile(statePath("generated", "tags.json"), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ tags: {}, docs: {} });
  }
}
