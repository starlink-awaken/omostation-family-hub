import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const AI_GATEWAY = process.env.FAMILY_AI_GATEWAY || "";

export async function buildEmbeddings(outputDir: string): Promise<void> {
  const docsPath = path.join(outputDir, "search-index.json");
  const docs: { text: string }[] = JSON.parse(await readFile(docsPath, "utf8"));

  if (docs.length === 0) {
    console.log("build:data embeddings: no docs to embed");
    return;
  }

  console.log(`build:data generating ${docs.length} embeddings via oMLX...`);
  const batchSize = 100;
  const embeddings: number[][] = [];
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize).map((d) => d.text || "");
    const res = await fetch(`${AI_GATEWAY}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "embed", input: batch }),
    });
    if (!res.ok) throw new Error(`Embed batch ${i} failed (${res.status})`);
    const data: { data: { embedding: number[] }[] } = await res.json();
    for (const d of data.data) embeddings.push(d.embedding);
    console.log(`  batch ${i / batchSize + 1}/${Math.ceil(docs.length / batchSize)} (${embeddings.length}/${docs.length})`);
  }

  const out = path.join(outputDir, "search-embeddings.json");
  await writeFile(out, JSON.stringify(embeddings) + "\n", "utf8");
  console.log(`build:data wrote ${out} (${embeddings.length} vectors)`);
}

export async function buildChunkEmbeddings(outputDir: string): Promise<void> {
  const chunksPath = path.join(outputDir, "search-chunks.json");
  const chunks: { text: string }[] = JSON.parse(await readFile(chunksPath, "utf8"));

  if (chunks.length === 0) {
    console.log("build:data chunk-embeddings: no chunks to embed");
    return;
  }

  console.log(`build:data generating ${chunks.length} chunk embeddings via oMLX...`);
  const batchSize = 100;
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((c) => c.text);
    const res = await fetch(`${AI_GATEWAY}/v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "embed", input: batch }),
    });
    if (!res.ok) throw new Error(`Chunk embed batch ${i} failed (${res.status})`);
    const data: { data: { embedding: number[] }[] } = await res.json();
    for (const d of data.data) embeddings.push(d.embedding);
    console.log(`  batch ${i / batchSize + 1}/${Math.ceil(chunks.length / batchSize)} (${embeddings.length}/${chunks.length})`);
  }

  const out = path.join(outputDir, "search-chunks-embeddings.json");
  await writeFile(out, JSON.stringify(embeddings) + "\n", "utf8");
  console.log(`build:data wrote ${out} (${embeddings.length} vectors)`);
}
