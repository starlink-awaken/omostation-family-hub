import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { ssotPath } from "../src/lib/ssot";
import { statePath } from "../src/lib/paths";

async function checkPath(rel: string, label: string): Promise<{ ok: boolean; msg: string }> {
  const resolved = ssotPath(rel);
  try {
    await access(resolved);
    return { ok: true, msg: "" };
  } catch {
    return { ok: false, msg: `  [MISSING] ${label}: "${rel}" -> ${resolved}` };
  }
}

async function findSourcePaths(filePath: string): Promise<string[]> {
  const raw = await readFile(filePath, "utf8");
  const paths: string[] = [];
  const re = /sourcePath:\s*(.*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const val = m[1].replace(/^["']|["']$/g, "").trim();
    if (val && !val.startsWith("#")) paths.push(val);
  }
  return paths;
}

async function findDocHrefs(filePath: string): Promise<{ rel: string; line: number }[]> {
  const raw = await readFile(filePath, "utf8");
  const results: { rel: string; line: number }[] = [];
  const lines = raw.split("\n");
  const re = /\/doc\?path=([^\s"')\]},]+)/g;
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lines[i])) !== null) {
      const rel = decodeURIComponent(m[1]);
      if (rel.startsWith("_knowledge") || rel.startsWith("_archive") || rel.startsWith("_control")) {
        results.push({ rel, line: i + 1 });
      }
    }
  }
  return results;
}

async function main(): Promise<void> {
  const manifestDir = statePath("manifests");
  let totalChecked = 0;
  let totalMissing = 0;
  const missingFiles: string[] = [];

  // 1. Check YAML sourcePath fields
  const manifests = ["summary.yaml", "members.yaml", "health.yaml", "growth.yaml", "daily.yaml", "assets.yaml"];
  for (const name of manifests) {
    const fp = path.join(manifestDir, name);
    let paths: string[];
    try {
      paths = await findSourcePaths(fp);
    } catch {
      console.error(`  [SKIP] cannot read ${name}`);
      continue;
    }
    for (const rel of paths) {
      totalChecked++;
      const r = await checkPath(rel, `${name}: sourcePath`);
      if (!r.ok) { totalMissing++; missingFiles.push(r.msg); console.error(r.msg); }
    }
  }

  // 2. Check hardcoded build paths
  for (const rel of ["_control/STATUS.md", "_control/STATE.md", "_control/signals.md", "_control/TIMELINE.md"]) {
    totalChecked++;
    const r = await checkPath(rel, "build-all.ts");
    if (!r.ok) { totalMissing++; missingFiles.push(r.msg); console.error(r.msg); }
  }

  // 3. Check doc hrefs in source code files
  const srcFiles = [
    "src/lib/person-registry.ts",
    "src/app/(app)/finance/page.tsx",
  ];
  const filesToScan = [
    ...srcFiles.map((label) => ({ label, path: path.resolve(process.cwd(), label) })),
    ...manifests.map((name) => ({ label: `manifests/${name}`, path: path.join(manifestDir, name) })),
  ];
  for (const sourceFile of filesToScan) {
    let refs: { rel: string; line: number }[];
    try {
      refs = await findDocHrefs(sourceFile.path);
    } catch {
      continue;
    }
    for (const ref of refs) {
      totalChecked++;
      const r = await checkPath(ref.rel, `${sourceFile.label}:${ref.line}`);
      if (!r.ok) { totalMissing++; missingFiles.push(r.msg); console.error(r.msg); }
    }
  }

  if (totalMissing > 0) {
    console.error(`\n  ✗ ${totalMissing} / ${totalChecked} references point to non-existent files:`);
    for (const m of missingFiles) console.error(m);
    process.exit(1);
  } else {
    console.log(`  ✓ all ${totalChecked} references verified`);
  }
}

main().catch((err) => {
  console.error("verify-paths failed:", err);
  process.exit(1);
});
