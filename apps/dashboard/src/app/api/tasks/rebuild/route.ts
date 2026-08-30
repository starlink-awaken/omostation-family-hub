import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const DATA_FILE = path.join(process.cwd(), "app-data", "tasks.json");

export async function POST() {
  try {
    await readFile(DATA_FILE, "utf8");
    return NextResponse.json({ ok: true, message: "tasks.json 已存在，无需重建" });
  } catch {
    return NextResponse.json(
      { error: "tasks.json 不存在，请重新构建 Docker 镜像以生成初始数据" },
      { status: 404 },
    );
  }
}
