import { readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

const DATA_FILE = statePath("generated", "tasks.json");

async function loadTasks() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

interface TaskDoc { id: string; text: string; done: boolean; sourcePath: string; sourceTitle: string; domain: string; }

function groupByDomain(tasks: TaskDoc[]) {
  const map: Record<string, { pending: TaskDoc[]; done: TaskDoc[] }> = {};

  for (const task of tasks) {
    const d = task.domain || "未分类";
    if (!map[d]) map[d] = { pending: [], done: [] };
    if (task.done) {
      map[d].done.push(task);
    } else {
      map[d].pending.push(task);
    }
  }

  const groups = Object.entries(map).map(([domain, items]) => ({
    domain,
    pending: items.pending,
    done: items.done,
  }));

  groups.sort((a, b) => {
    const aHas = a.pending.length > 0 ? 0 : 1;
    const bHas = b.pending.length > 0 ? 0 : 1;
    return aHas - bHas;
  });

  return groups;
}

export async function GET() {
  try {
    const tasks = await loadTasks();
    const groups = groupByDomain(tasks);
    return NextResponse.json({ groups });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "获取任务失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { taskId, done } = await request.json();
    if (typeof taskId !== "string") {
      return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
    }

    const tasks = await loadTasks();
    const idx = tasks.findIndex((t: TaskDoc) => t.id === taskId);
    if (idx === -1) {
      return NextResponse.json({ error: "任务未找到" }, { status: 404 });
    }

    tasks[idx].done = !!done;
    await writeFile(DATA_FILE, JSON.stringify(tasks, null, 2));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新任务失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
