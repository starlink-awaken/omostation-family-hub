import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

test("deployment mounts Documents read-only and state separately", async () => {
  const compose = await readFile(path.join(process.cwd(), "docker-compose.yml"), "utf8");
  const entrypoint = await readFile(path.join(process.cwd(), "_deploy", "entrypoint.sh"), "utf8");
  const dockerfile = await readFile(path.join(process.cwd(), "_deploy", "Dockerfile"), "utf8");

  expect(compose).toContain("FAMILY_DOCUMENTS_ROOT=/documents");
  expect(compose).toContain("FAMILY_DASHBOARD_STATE_ROOT=/state");
  expect(compose).toContain(":/documents:ro");
  expect(compose).toContain(":/state:rw");
  expect(compose).not.toContain("FAMILY_SSOT_ROOT");
  expect(entrypoint).toContain("FAMILY_DOCUMENTS_ROOT");
  expect(entrypoint).toContain("FAMILY_DASHBOARD_STATE_ROOT");
  expect(entrypoint).not.toContain("FAMILY_SSOT_ROOT");
  expect(dockerfile).not.toContain("data-manifest");
  expect(dockerfile).toContain("oven/bun:1.3.14");
});
