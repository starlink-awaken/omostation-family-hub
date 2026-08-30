import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadAppData<T>(fileName: string): Promise<T> {
  const p = path.join(process.cwd(), "app-data", fileName);
  const raw = await readFile(p, "utf-8");
  return JSON.parse(raw) as T;
}
