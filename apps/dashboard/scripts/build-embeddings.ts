import { buildEmbeddings, buildChunkEmbeddings } from "./builders/embedding-builders";
import { measure, printSummary } from "./builders/common";
import path from "node:path";

const outputDir = path.join(process.cwd(), "app-data");

async function main() {
  const results = [];

  const [_, searchEmb] = await measure("embeddings", () => buildEmbeddings(outputDir));
  results.push(searchEmb);
  const [__, chunkEmb] = await measure("chunk-embeddings", () => buildChunkEmbeddings(outputDir));
  results.push(chunkEmb);

  printSummary(results);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
