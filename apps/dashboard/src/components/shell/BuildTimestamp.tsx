import { readFile } from "node:fs/promises";
import path from "node:path";

export async function BuildTimestamp() {
  let label = "数据加载中";
  try {
    const metaPath = path.join(process.cwd(), "app-data", "build-meta.json");
    const raw = await readFile(metaPath, "utf8");
    const { builtAt } = JSON.parse(raw) as { builtAt: string };
    const d = new Date(builtAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    const cnDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const cnTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    label = `${cnDate} ${cnTime} 更新`;
  } catch {
    label = "更新时间未知";
  }

  return (
    <span className="text-xs" style={{ color: "var(--family-text-4, var(--family-text-3))" }}>
      {label}
    </span>
  );
}
