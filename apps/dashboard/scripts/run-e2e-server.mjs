import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { fixtureBuildEnv } from "./run-next-build.mjs";

const projectRoot = process.cwd();
const stateRoot = mkdtempSync(path.join(os.tmpdir(), "family-dashboard-e2e-state-"));
const env = {
  ...fixtureBuildEnv(projectRoot, stateRoot),
  NODE_ENV: "development",
  FAMILY_DASHBOARD_PASSWORD: "synthetic-e2e-password",
  FAMILY_CSRF_TOKEN: "synthetic-e2e-csrf",
};
const bunExecutable = process.env.npm_execpath;
if (!bunExecutable || path.basename(bunExecutable) !== "bun") {
  throw new Error("E2E server must be invoked through a trusted Bun executable");
}

cpSync(
  path.join(projectRoot, "tests", "fixtures", "state", "manifests"),
  path.join(stateRoot, "manifests"),
  { recursive: true },
);
const build = spawnSync(bunExecutable, ["run", "scripts/build-all.ts"], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const css = spawnSync(bunExecutable, ["run", "scripts/build-css.mjs"], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});
if (css.error) throw css.error;
if (css.status !== 0) process.exit(css.status ?? 1);

const server = spawn(
  path.join(projectRoot, "node_modules", ".bin", "next"),
  ["dev", "--hostname", "127.0.0.1", "--port", "3000"],
  { cwd: projectRoot, env, stdio: "inherit" },
);

function cleanup() {
  if (!server.killed) server.kill("SIGTERM");
  rmSync(stateRoot, { recursive: true, force: true });
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
server.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
