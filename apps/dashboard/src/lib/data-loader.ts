import { readFile } from "node:fs/promises";
import { statePath } from "./paths";

export async function loadAppData<T>(fileName: string): Promise<T> {
  const p = statePath("generated", fileName);
  const raw = await readFile(p, "utf-8");
  return JSON.parse(raw) as T;
}
