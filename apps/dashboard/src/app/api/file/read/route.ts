import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveSsotPath } from "@/lib/ssot";

export async function POST(request: Request) {
  try {
    const { path: relPath } = (await request.json()) as { path?: string };

    if (!relPath) {
      return NextResponse.json({ error: "缺少 path" }, { status: 400 });
    }

    const resolved = resolveSsotPath(relPath);
    if (!resolved) {
      return NextResponse.json({ error: "非法路径" }, { status: 403 });
    }

    const content = await readFile(resolved, "utf8");
    return NextResponse.json({ content, path: relPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "读取失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
