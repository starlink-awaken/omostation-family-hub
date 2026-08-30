import path from "node:path";
import { documentsRoot, resolveDocumentsPath } from "./paths";

export function getSsotRoot(): string {
  return documentsRoot();
}

export function ssotPath(...parts: string[]): string {
  const resolved = resolveDocumentsPath(path.join(...parts));
  if (!resolved) throw new Error("Documents path is unsafe");
  return resolved;
}

export function resolveSsotPath(relativePath: string): string | null {
  return resolveDocumentsPath(relativePath);
}

const WRITABLE_ROOTS = [
  "_control/",
  "_entities/",
  "_knowledge/",
  "_meta/",
  "_storage/inbox/",
  "_storage/99-中转/",
];

const WRITABLE_EXTS = new Set([
  ".md",
  ".markdown",
  ".yaml",
  ".yml",
  ".json",
  ".txt",
]);

export function canWriteSsotPath(relativePath: string): boolean {
  const resolved = resolveSsotPath(relativePath);
  if (!resolved) return false;

  const safeRelative = path
    .relative(path.resolve(getSsotRoot()), resolved)
    .split(path.sep)
    .join("/");
  const fileName = path.posix.basename(safeRelative);
  const ext = path.posix.extname(safeRelative).toLowerCase();

  if (safeRelative.startsWith("../") || safeRelative === "..") return false;
  if (!fileName || fileName.startsWith(".")) return false;
  if (!WRITABLE_EXTS.has(ext)) return false;

  return WRITABLE_ROOTS.some((root) => safeRelative.startsWith(root));
}
