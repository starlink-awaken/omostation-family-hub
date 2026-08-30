import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { hasValidCsrfHeader } from "@/lib/csrf";
import { canWriteSsotPath, resolveSsotPath } from "@/lib/ssot";
import { autoTag, updateFrontmatterTags } from "@/lib/auto-tagger";
import { extractFrontmatter } from "@/lib/extract";
import { extractAllTasks } from "@/lib/task-extractor";

async function appendAuditLog(relPath: string, content: string) {
  const auditDir = path.join(process.cwd(), ".local-audit");
  await mkdir(auditDir, { recursive: true });
  await appendFile(
    path.join(auditDir, "file-writes.jsonl"),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      action: "file.save",
      path: relPath,
      bytes: Buffer.byteLength(content, "utf8"),
    })}\n`,
    "utf8",
  );
}

export async function POST(request: Request) {
  try {
    if (!hasValidCsrfHeader(request.headers)) {
      return NextResponse.json({ error: "缺少 CSRF 校验" }, { status: 403 });
    }

    const { path: relPath, content } = (await request.json()) as {
      path?: string;
      content?: string;
    };

    if (!relPath || content === undefined) {
      return NextResponse.json({ error: "缺少 path 或 content" }, { status: 400 });
    }

    if (!canWriteSsotPath(relPath)) {
      return NextResponse.json({ error: "路径不在可写白名单内" }, { status: 403 });
    }

    const resolved = resolveSsotPath(relPath);
    if (!resolved) {
      return NextResponse.json({ error: "非法路径" }, { status: 403 });
    }

    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, content, "utf8");
    await appendAuditLog(relPath, content);

    Promise.resolve().then(async () => {
      try {
        const frontmatter = extractFrontmatter(content);
        const existingTags = (frontmatter.tags as string[]) || [];
        const newTags = await autoTag(content, existingTags);
        if (newTags.length > 0 && JSON.stringify(newTags) !== JSON.stringify(existingTags)) {
          const updatedContent = updateFrontmatterTags(content, newTags);
          await writeFile(resolved, updatedContent, "utf8");
        }
        try {
          const tasks = await extractAllTasks();
          const tasksPath = path.join(process.cwd(), "src", "app", "data", "tasks.json");
          const tasksDir = path.dirname(tasksPath);
          await mkdir(tasksDir, { recursive: true });
          const existingMap: Record<string, boolean> = {};
          try {
            const existingRaw = await readFile(tasksPath, "utf8");
            const existing = JSON.parse(existingRaw);
            if (Array.isArray(existing)) {
              for (const t of existing) {
                if (t.id && typeof t.done === "boolean") existingMap[t.id] = t.done;
              }
            }
          } catch {}
          for (const t of tasks) {
            if (existingMap[t.id] !== undefined) t.done = existingMap[t.id];
          }
          await writeFile(tasksPath, JSON.stringify(tasks, null, 2), "utf8");
        } catch {}
      } catch {
        // post-save hooks 失败不阻塞响应
      }
    });

    return NextResponse.json({ ok: true, path: relPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "保存失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
