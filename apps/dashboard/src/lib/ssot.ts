import path from "node:path";

export function getSsotRoot(): string {
  return process.env.FAMILY_SSOT_ROOT || path.resolve(process.cwd(), "..");
}

export function ssotPath(...parts: string[]): string {
  return path.join(getSsotRoot(), ...parts);
}

export function resolveSsotPath(relativePath: string): string | null {
  if (!relativePath) return null;
  if (relativePath.includes("\0")) return null;
  if (relativePath.startsWith("/") || relativePath.startsWith("\\")) return null;

  const root = getSsotRoot();
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);

  if (resolved === resolvedRoot) return resolved;

  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (!resolved.startsWith(prefix)) return null;

  return resolved;
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
