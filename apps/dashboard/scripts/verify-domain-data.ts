import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { statePath } from "../src/lib/paths";

type DomainJson = {
  meta?: {
    schemaVersion?: string;
    generatedAt?: string;
    sources?: string[];
  };
  overview?: {
    title?: string;
    totalCount?: number;
    sourceCount?: number;
  };
  focus?: Array<{ id?: string; title?: string; sourcePath?: string }>;
  nextActions?: Array<{ id?: string; title?: string; sourcePath?: string }>;
  links?: Array<{ title?: string; href?: string }>;
  items?: Array<{ id?: string; title?: string; sourcePath?: string }>;
  updatedAt?: string;
};

const DOMAIN_FILES = [
  "members.json",
  "health.json",
  "growth.json",
  "daily.json",
  "assets.json",
] as const;

async function readJson(filePath: string): Promise<DomainJson> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as DomainJson;
}

function isIsoDateTime(input: string | undefined): boolean {
  if (!input) {
    return false;
  }

  return !Number.isNaN(Date.parse(input));
}

async function main() {
  const appDataDir = statePath("generated");

  for (const fileName of DOMAIN_FILES) {
    const filePath = path.join(appDataDir, fileName);
    const data = await readJson(filePath);

    assert.equal(data.meta?.schemaVersion, "v1");
    assert.ok(isIsoDateTime(data.meta?.generatedAt), `${fileName} generatedAt 必须是 ISO 时间`);
    assert.ok(Array.isArray(data.meta?.sources), `${fileName} meta.sources 必须为数组`);

    assert.ok(data.overview?.title, `${fileName} overview.title 必须存在`);
    assert.ok(
      typeof data.overview?.totalCount === "number",
      `${fileName} overview.totalCount 必须为数字`,
    );
    assert.ok(
      typeof data.overview?.sourceCount === "number",
      `${fileName} overview.sourceCount 必须为数字`,
    );

    assert.ok(Array.isArray(data.focus), `${fileName} focus 必须为数组`);
    assert.ok(Array.isArray(data.nextActions), `${fileName} nextActions 必须为数组`);
    assert.ok(Array.isArray(data.links), `${fileName} links 必须为数组`);
    assert.ok(Array.isArray(data.items), `${fileName} items 必须为数组`);
    assert.equal(data.overview?.totalCount, data.items?.length, `${fileName} count 必须匹配 items`);
    assert.equal(
      data.overview?.sourceCount,
      new Set(data.meta?.sources ?? []).size,
      `${fileName} sourceCount 必须匹配 sources`,
    );
    assert.ok(isIsoDateTime(data.updatedAt), `${fileName} updatedAt 必须是 ISO 时间`);
  }

  console.log("verify-domain-data: ok");
}

main().catch((error) => {
  console.error("verify-domain-data: failed");
  console.error(error);
  process.exit(1);
});
