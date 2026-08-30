import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSsotRoot } from "@/lib/ssot";
import { IMAGE_EXTS } from "../file/[...path]/route";

export type TreeNode = {
  name: string;
  type: "dir" | "file";
  path: string;
  kind?: "md" | "image";
  count?: number;
  children?: TreeNode[];
};

const MD_EXTS = new Set([".md", ".markdown"]);

async function buildTree(dir: string, baseDir: string): Promise<TreeNode[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes: TreeNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(baseDir, full);
    const ext = path.extname(entry.name).toLowerCase();

    if (entry.isDirectory()) {
      const children = await buildTree(full, baseDir);
      const total = children.reduce((s, c) => s + (c.count ?? 1), 0);
      nodes.push({ name: entry.name, type: "dir", path: rel, count: total, children });
    } else if (MD_EXTS.has(ext)) {
      try {
        const raw = await readFile(full, "utf8");
        const lines = raw.split("\n");
        let title = entry.name.replace(/\.md$/, "");
        if (lines[0]?.trim() === "---") {
          const end = lines.indexOf("---", 1);
          if (end !== -1) {
            for (let i = 1; i < end; i++) {
              const m = lines[i].match(/^title:\s*(.+)/);
              if (m) title = m[1].replace(/^["']|["']$/g, "");
            }
          }
        }
        nodes.push({ name: title || entry.name.replace(/\.md$/, ""), type: "file", path: rel, kind: "md" });
      } catch {
        nodes.push({ name: entry.name.replace(/\.md$/, ""), type: "file", path: rel, kind: "md" });
      }
    } else if (IMAGE_EXTS.has(ext)) {
      nodes.push({ name: entry.name, type: "file", path: rel, kind: "image" });
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-CN");
  });
  return nodes;
}

export async function GET() {
  const ssot = getSsotRoot();
  const knowledge: TreeNode[] = await buildTree(path.join(ssot, "_knowledge"), ssot);
  const archive: TreeNode[] = await buildTree(path.join(ssot, "_archive"), ssot);
  return NextResponse.json({ knowledge, archive }, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
  });
}
