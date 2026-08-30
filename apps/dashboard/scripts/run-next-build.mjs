import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function fixtureBuildEnv(projectRoot, stateRoot) {
  return {
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME ?? os.tmpdir(),
    TMPDIR: process.env.TMPDIR ?? os.tmpdir(),
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
    NODE_ENV: "production",
    CI: process.env.CI ?? "1",
    FAMILY_DOCUMENTS_ROOT: path.join(projectRoot, "tests", "fixtures", "documents"),
    FAMILY_DASHBOARD_STATE_ROOT: path.resolve(stateRoot),
    FAMILY_DASHBOARD_PASSWORD: "synthetic-build-only",
    FAMILY_CSRF_TOKEN: "synthetic-build-csrf",
  };
}

function run(command, cwd, env) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function trustedBunExecutable() {
  const executable = process.env.npm_execpath;
  if (!executable || path.basename(executable) !== "bun") {
    throw new Error("build must be invoked through a trusted Bun executable");
  }
  return executable;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const projectRoot = process.cwd();
  const stateRoot = mkdtempSync(path.join(os.tmpdir(), "family-dashboard-build-state-"));
  const env = fixtureBuildEnv(projectRoot, stateRoot);
  const bunExecutable = trustedBunExecutable();
  cpSync(
    path.join(projectRoot, "tests", "fixtures", "state", "manifests"),
    path.join(stateRoot, "manifests"),
    { recursive: true },
  );
  try {
    run([bunExecutable, "run", "scripts/build-all.ts"], projectRoot, env);
    run([bunExecutable, "run", "scripts/build-css.mjs"], projectRoot, env);
    run([path.join(projectRoot, "node_modules", ".bin", "next"), "build"], projectRoot, env);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
}
