import { NextResponse } from "next/server";
import { hasValidCsrfHeader } from "@/lib/csrf";

export async function POST(request: Request) {
  if (!hasValidCsrfHeader(request.headers)) {
    return NextResponse.json({ error: "缺少 CSRF 校验" }, { status: 403 });
  }

  try {
    const { execFileSync } = await import("node:child_process");
    const cwd = process.cwd();

    console.log("/api/rebuild: starting build-all...");
    const output = execFileSync("bun", ["run", "build:data"], {
      cwd,
      encoding: "utf8",
      timeout: 300_000,
      env: { ...process.env, PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin" },
    });

    const lines = output.trim().split("\n");
    console.log(`/api/rebuild: completed (${lines.length} lines)`);

    return NextResponse.json({
      ok: true,
      lines: lines.filter((l: string) => l.startsWith("build:data")),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("/api/rebuild failed:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
