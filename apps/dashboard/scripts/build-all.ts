import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { DomainKey } from "../src/types/domain";
import { buildSummary } from "./builders/summary";
import { buildDomainData } from "./builders/domain-data";
import {
  buildCalendar,
  buildTimelineData,
  buildFinance,
  buildTasks,
  buildMilestones,
  buildVaccines,
} from "./builders/independent-builders";
import {
  buildSearchIndex,
  buildChunkIndex,
  buildTagIndex,
  buildLinksIndex,
} from "./builders/index-builders";
import { measure, printSummary, type BuilderResult } from "./builders/common";

const DOMAIN_KEYS: DomainKey[] = [
  "members",
  "health",
  "growth",
  "daily",
  "assets",
];

const args = process.argv.slice(2);
const runFast = args.includes("--fast");
const runEmbeddings = args.includes("--embeddings");
const singleDomain = args
  .filter((a) => !a.startsWith("--"))
  .map((a) => a as DomainKey)
  .find((a) => DOMAIN_KEYS.includes(a));

async function writeAndVerify(filePath: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2) + "\n";
  await writeFile(filePath, json, "utf8");
  const written = await readFile(filePath, "utf8");
  JSON.parse(written);
}

async function main() {
  const outputDir = path.join(process.cwd(), "app-data");
  await mkdir(outputDir, { recursive: true });

  const results: BuilderResult[] = [];

  if (!singleDomain) {
    const [summary, summaryRes] = await measure("summary", () => buildSummary(), "summary.json");
    results.push(summaryRes);
    if (summary) {
      const p = path.join(outputDir, "summary.json");
      await writeAndVerify(p, summary);
    }
  }

  const domainsToBuild = singleDomain ? [singleDomain] : DOMAIN_KEYS;
  for (const domain of domainsToBuild) {
    const [data, res] = await measure(domain, () => buildDomainData(domain), `${domain}.json`);
    results.push(res);
    if (data) {
      const p = path.join(outputDir, `${domain}.json`);
      await writeAndVerify(p, data);
    }
  }

  if (!runFast && !singleDomain) {
    const [milData, milRes] = await measure("milestones", () => buildMilestones(), "milestones.json");
    results.push(milRes);
    if (milData) {
      const p = path.join(outputDir, "milestones.json");
      await writeAndVerify(p, milData);
    }

    const [vacData, vacRes] = await measure("vaccines", () => buildVaccines(), "vaccines.json");
    results.push(vacRes);
    if (vacData) {
      const p = path.join(outputDir, "vaccines.json");
      await writeAndVerify(p, vacData);
    }
  }

  if (!runFast && !singleDomain) {
    const [indepData, indepRes] = await measure("independent", async () => {
      const [c, t, f, tk] = await Promise.all([
        buildCalendar(),
        buildTimelineData(),
        buildFinance(),
        buildTasks(),
      ]);
      return [c, t, f, tk] as const;
    });
    results.push({ ...indepRes, name: "calendar, timeline, finance, tasks" });
    const [calData, tlData, finData, taskData] = indepData ?? [];
    if (calData) {
      const p = path.join(outputDir, "calendar.json");
      await writeAndVerify(p, calData);
    }
    if (tlData) {
      const p = path.join(outputDir, "timeline.json");
      await writeAndVerify(p, tlData);
    }
    if (finData) {
      const p = path.join(outputDir, "finance.json");
      await writeAndVerify(p, finData);
    }
    if (taskData) {
      const p = path.join(outputDir, "tasks.json");
      await writeAndVerify(p, taskData);
    }
  }

  if (!runFast) {
    const builtAt = new Date().toISOString();
    const metaPath = path.join(outputDir, "build-meta.json");
    await writeAndVerify(metaPath, { builtAt });
  }

  if (!runFast && !singleDomain) {
    const [_, searchRes] = await measure("search-index", () => buildSearchIndex(outputDir));
    results.push(searchRes);

    const [__, chunkRes] = await measure("chunk-index", () => buildChunkIndex(outputDir));
    results.push(chunkRes);

    const [___, tagRes] = await measure("tag-index", () => buildTagIndex(outputDir));
    results.push(tagRes);

    const [____, linkRes] = await measure("links-index", () => buildLinksIndex(outputDir));
    results.push(linkRes);

    if (runEmbeddings) {
      const { buildEmbeddings, buildChunkEmbeddings } = await import("./builders/embedding-builders");
      const [__e, embRes] = await measure("embeddings", () => buildEmbeddings(outputDir));
      results.push(embRes);
      const [__c, chunkEmbRes] = await measure("chunk-embeddings", () => buildChunkEmbeddings(outputDir));
      results.push(chunkEmbRes);
    }
  }

  printSummary(results);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
