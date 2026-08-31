import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import { documentsRoot, statePath } from "@/lib/paths";

const ALLOWED = new Set([".md", ".markdown", ".yaml", ".yml", ".json", ".txt"]);
const EXCLUDED_TOP_LEVEL = new Set(["family-dashboard-app"]);

async function regularFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const candidate = path.join(current, entry.name);
    const relative = path.relative(root, candidate);
    if (!relative.includes(path.sep) && EXCLUDED_TOP_LEVEL.has(relative)) continue;
    if (entry.isSymbolicLink()) throw new Error("Documents snapshot crosses a symlink");
    if (entry.isDirectory()) result.push(...(await regularFiles(root, candidate)));
    else if (entry.isFile() && ALLOWED.has(path.extname(entry.name).toLowerCase())) result.push(candidate);
  }
  return result;
}

export async function createDocumentsSnapshotReceipt() {
  const root = documentsRoot();
  const files = await regularFiles(root);
  let bytes = 0;
  const tree = createHash("sha256");
  for (const file of files) {
    const [metadata, content] = await Promise.all([stat(file), readFile(file)]);
    bytes += metadata.size;
    const relative = path.relative(root, file).split(path.sep).join("/");
    const digest = createHash("sha256").update(content).digest("hex");
    tree.update(`${relative}\0${(metadata.mode & 0o7777).toString(8)}\0${metadata.size}\0${digest}\n`);
  }
  const receipt = {
    schema: "family-documents-snapshot/v1",
    fileCount: files.length,
    byteCount: bytes,
    treeSha256: `sha256:${tree.digest("hex")}`,
    writesDocuments: false,
  };
  const directory = statePath("audit");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, `documents-snapshot-${randomUUID()}.json`);
  const temporary = `${target}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, target);
    await chmod(target, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
  return receipt;
}
