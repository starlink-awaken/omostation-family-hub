import { existsSync, lstatSync } from "node:fs";
import path from "node:path";

function requireAbsoluteRoot(name: "FAMILY_DOCUMENTS_ROOT" | "FAMILY_DASHBOARD_STATE_ROOT"): string {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`${name} is required`);
  if (!path.isAbsolute(raw)) throw new Error(`${name} must be absolute`);
  const resolved = path.resolve(raw);
  if (existsSync(resolved) && lstatSync(resolved).isSymbolicLink()) {
    throw new Error(`${name} must not be a symlink`);
  }
  return resolved;
}

export function documentsRoot(): string {
  return requireAbsoluteRoot("FAMILY_DOCUMENTS_ROOT");
}

export function stateRoot(): string {
  const root = requireAbsoluteRoot("FAMILY_DASHBOARD_STATE_ROOT");
  const documents = documentsRoot();
  if (root === documents || root.startsWith(`${documents}${path.sep}`)) {
    throw new Error("FAMILY_DASHBOARD_STATE_ROOT must be outside Documents");
  }
  return root;
}

function containsTraversal(relativePath: string): boolean {
  return relativePath.split(/[\\/]/u).some((part) => part === "..");
}

function hasSymlinkComponent(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  let cursor = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) return true;
  }
  return false;
}

export function resolveDocumentsPath(relativePath: string): string | null {
  if (!relativePath || relativePath.includes("\0") || path.isAbsolute(relativePath)) return null;
  if (relativePath.startsWith("\\") || containsTraversal(relativePath)) return null;
  const root = documentsRoot();
  const candidate = path.resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  if (hasSymlinkComponent(root, candidate)) return null;
  return candidate;
}

export function statePath(...parts: string[]): string {
  const root = stateRoot();
  const candidate = path.resolve(root, ...parts);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error("state path escapes FAMILY_DASHBOARD_STATE_ROOT");
  }
  if (hasSymlinkComponent(root, candidate)) {
    throw new Error("state path crosses a symlink");
  }
  return candidate;
}
