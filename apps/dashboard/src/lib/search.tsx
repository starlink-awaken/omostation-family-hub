import { aiEmbed } from "./ai";

export type SearchDoc = {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  text: string;
  tags: string[];
};

export type SearchChunk = {
  id: string;
  docTitle: string;
  chunkHeading: string;
  path: string;
  text: string;
  tags: string[];
  domain: string;
};

export function scoreDoc(doc: SearchDoc, query: string): number {
  const q = query.toLowerCase();
  const title = doc.title.toLowerCase();
  const text = doc.text.toLowerCase();
  const tagText = doc.tags.join(" ").toLowerCase();
  let score = 0;

  if (title.startsWith(q)) score += 30;
  else if (title.includes(` ${q}`)) score += 20;
  else if (title.includes(q)) score += 15;

  if (text.includes(q)) score += 10;
  if (text.startsWith(q) || text.includes(` ${q}`)) score += 5;

  for (const word of q.split(/\s+/)) {
    if (word.length < 2) continue;
    if (title.includes(word)) score += 4;
    if (text.includes(word)) score += 2;
    if (tagText.includes(word)) score += 1;
  }

  return score;
}

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part)
      ? <mark key={i} style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)", fontWeight: 600, borderRadius: 2, padding: "0 1px" }}>{part}</mark>
      : part
  );
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function scoreChunk(chunk: SearchChunk, query: string): number {
  const q = query.toLowerCase();
  const title = chunk.docTitle.toLowerCase();
  const heading = chunk.chunkHeading.toLowerCase();
  const text = chunk.text.toLowerCase();
  const tagText = chunk.tags.join(" ").toLowerCase();
  let score = 0;

  if (title.startsWith(q)) score += 20;
  else if (title.includes(q)) score += 10;

  if (heading.startsWith(q)) score += 15;
  else if (heading.includes(` ${q}`)) score += 10;
  else if (heading.includes(q)) score += 8;

  if (text.startsWith(q)) score += 12;
  else if (text.includes(` ${q}`)) score += 8;
  else if (text.includes(q)) score += 5;

  for (const word of q.split(/\s+/)) {
    if (word.length < 2) continue;
    if (title.includes(word)) score += 3;
    if (heading.includes(word)) score += 4;
    if (text.includes(word)) score += 2;
    if (tagText.includes(word)) score += 1;
  }

  return score;
}

export async function searchChunks(
  chunks: SearchChunk[],
  chunkEmbeddings: number[][] | null,
  query: string,
  limit = 8,
): Promise<{ chunk: SearchChunk; score: number; semanticScore: number }[]> {
  const qEmbed = chunkEmbeddings ? await aiEmbed([query]).catch(() => null) : null;

  const scored = chunks.map((chunk, i) => {
    const kw = scoreChunk(chunk, query);
    let sem = 0;
    if (qEmbed && chunkEmbeddings?.[i]) {
      sem = Math.max(0, cosineSimilarity(qEmbed[0], chunkEmbeddings[i]));
    }
    return { chunk, score: kw + sem * 50, semanticScore: sem };
  });

  return scored
    .filter((r) => r.score > 0 || r.semanticScore > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
