import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { statePath } from "../src/lib/paths";

type SummaryJson = {
  meta?: {
    schemaVersion?: string;
    generatedAt?: string;
    sources?: string[];
  };
  overview?: {
    current?: string;
    phase?: string;
    lastUpdated?: string;
  };
  weekFocus?: Array<{ id?: string; title?: string }>;
  entries?: {
    primary?: { title?: string; href?: string };
    secondary?: Array<{ title?: string; href?: string }>;
  };
  recentUpdates?: Array<{ id?: string; title?: string; sourcePath?: string }>;
  signals?: Array<{ id?: string; title?: string; sourcePath?: string }>;
  updatedAt?: string;
};

async function readJson(filePath: string): Promise<SummaryJson> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as SummaryJson;
}

function isIsoDateTime(input: string | undefined): boolean {
  if (!input) {
    return false;
  }

  return !Number.isNaN(Date.parse(input));
}

async function main() {
  const summaryPath = statePath("generated", "summary.json");
  const summary = await readJson(summaryPath);

  assert.equal(summary.meta?.schemaVersion, "v1");
  assert.ok(isIsoDateTime(summary.meta?.generatedAt), "meta.generatedAt 必须是 ISO 时间");

  assert.equal(summary.overview?.current, "BUSY");
  assert.equal(summary.overview?.phase, "本地物理整合完成");
  assert.equal(summary.overview?.lastUpdated, "2026-07-02");

  assert.ok(summary.entries?.primary, "必须存在主入口");
  assert.equal(summary.entries?.primary?.href, "/members");
  assert.equal(summary.entries?.secondary?.length, 4);

  assert.ok(Array.isArray(summary.weekFocus), "weekFocus 必须为数组");
  assert.ok(Array.isArray(summary.recentUpdates), "recentUpdates 必须为数组");
  assert.ok(Array.isArray(summary.signals), "signals 必须为数组");

  assert.ok(
    summary.recentUpdates?.some((item) => item.sourcePath === "_control/TIMELINE.md"),
    "recentUpdates 必须包含 TIMELINE.md 来源",
  );
  assert.ok(
    summary.signals?.some((item) => item.sourcePath === "_control/signals.md"),
    "signals 必须包含 signals.md 来源",
  );

  const allText = JSON.stringify(summary);
  assert.ok(!allText.includes("月收入"), "summary.json 不应暴露 ENTITIES 敏感词");
  assert.ok(!allText.includes("家庭住址"), "summary.json 不应暴露住址字段");

  console.log("verify-summary: ok");
}

main().catch((error) => {
  console.error("verify-summary: failed");
  console.error(error);
  process.exit(1);
});
