import { watch } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { getSsotRoot } from "../src/lib/ssot";
import { statePath } from "../src/lib/paths";

const ROOT = getSsotRoot();
const PROJECT = path.resolve(process.cwd());
const WATCH_DIRS = [
  path.join(ROOT, "_knowledge"),
  path.join(ROOT, "_archive"),
  path.join(ROOT, "_control"),
  statePath("manifests"),
];

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let building = false;

async function triggerBuild() {
  if (building) return;
  building = true;
  console.log(`\n[watch-data] change detected, building…`);

  const start = Date.now();
  const child = spawn("bun", ["run", "scripts/build-all.ts"], {
    cwd: PROJECT,
    stdio: "inherit",
    shell: true,
  });

  return new Promise<void>((resolve) => {
    child.on("exit", (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`[watch-data] build:data done (${elapsed}s) — refresh browser to see changes`);
      } else {
        console.error(`[watch-data] build:data failed (exit ${code}) after ${elapsed}s`);
      }
      building = false;
      resolve();
    });
  });
}

function onFileChange(eventType: string, fileName: string | null) {
  if (!fileName) return;
  if (!fileName.endsWith(".md") && !fileName.endsWith(".yaml") && !fileName.endsWith(".yml") && !fileName.endsWith(".ts") && !fileName.endsWith(".css")) return;
  if (fileName.startsWith(".") || fileName.includes("node_modules") || fileName.includes(".git")) return;

  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(triggerBuild, 500);
}

for (const dir of WATCH_DIRS) {
  try {
    watch(dir, { recursive: true }, onFileChange);
    console.log(`[watch-data] watching ${path.relative(PROJECT, dir)}`);
  } catch (err) {
    console.error(`[watch-data] cannot watch ${dir}: ${err}`);
  }
}

console.log(`[watch-data] ready — Documents content and state manifests auto-rebuild`);

process.on("SIGINT", () => {
  process.exit(0);
});
