import path from "node:path";

import { expect, test } from "vitest";

import { fixtureBuildEnv } from "../../scripts/run-next-build.mjs";

test("fixture build roots are absolute, disjoint, and non-user-specific", () => {
  const projectRoot = path.resolve("/workspace/family-hub/apps/dashboard");
  const stateRoot = path.resolve("/private/tmp/family-dashboard-build-state");

  const env = fixtureBuildEnv(projectRoot, stateRoot);

  expect(env.FAMILY_DOCUMENTS_ROOT).toBe(path.join(projectRoot, "tests", "fixtures", "documents"));
  expect(env.FAMILY_DASHBOARD_STATE_ROOT).toBe(stateRoot);
  expect(path.isAbsolute(env.FAMILY_DOCUMENTS_ROOT)).toBe(true);
  expect(path.isAbsolute(env.FAMILY_DASHBOARD_STATE_ROOT)).toBe(true);
  expect(env.FAMILY_DASHBOARD_STATE_ROOT.startsWith(env.FAMILY_DOCUMENTS_ROOT)).toBe(false);
  expect(`${env.FAMILY_DOCUMENTS_ROOT}\n${env.FAMILY_DASHBOARD_STATE_ROOT}`).not.toContain("/Users/");
  expect(env).not.toHaveProperty("KIMI_CODE_API_KEY");
  expect(env).not.toHaveProperty("BARK_API_KEY");
});
