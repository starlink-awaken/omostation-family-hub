import { NextResponse } from "next/server";
import { authenticateCron } from "@/lib/cron-auth";
import { execSync } from "node:child_process";

export async function GET(request: Request) {
  const auth = authenticateCron(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const ssotRoot = process.env.FAMILY_SSOT_ROOT;
  if (!ssotRoot) {
    return NextResponse.json({ error: "FAMILY_SSOT_ROOT not set" }, { status: 500 });
  }

  try {
    // Check if we can use git (will fail gracefully in Docker without parent .git)
    const gitDir = execSync("git rev-parse --git-dir 2>/dev/null", {
      cwd: ssotRoot,
      encoding: "utf8",
      timeout: 5_000,
      env: { ...process.env, PATH: "/usr/bin:/usr/local/bin:/bin" },
    }).trim();

    if (!gitDir) {
      return NextResponse.json({
        ok: false,
        note: "SSOT is not a git repo inside Docker. Use host script: scripts/ssot-git-backup.sh",
        backedUpAt: new Date().toISOString(),
      });
    }

    const output = execSync(
      'git add -A && if git diff --cached --quiet; then echo "no changes"; else git commit -m "auto backup $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "committed"; fi',
      {
        cwd: ssotRoot,
        encoding: "utf8",
        timeout: 30_000,
        env: { ...process.env, PATH: "/usr/bin:/usr/local/bin:/bin" },
      },
    ).trim();

    return NextResponse.json({
      ok: true,
      result: output,
      backedUpAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      ok: false,
      note: "git not available or SSOT not in a git repo in container",
      backedUpAt: new Date().toISOString(),
    });
  }
}
