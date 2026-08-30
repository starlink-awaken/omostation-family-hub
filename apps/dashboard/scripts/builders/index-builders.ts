import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ssotPath } from "../../src/lib/ssot";

type FileDoc = {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  text: string;
  tags: string[];
};

type SearchChunk = {
  id: string;
  docTitle: string;
  chunkHeading: string;
  path: string;
  text: string;
  tags: string[];
  domain: string;
};

type TagIndex = {
  tags: Record<string, { count: number; docIds: string[] }>;
  docs: Record<string, { title: string; path: string; tags: string[] }>;
};

type LinkIndex = {
  links: Record<string, { source: string; sourceTitle: string; target: string; targetTitle: string; text: string }[]>;
  backlinks: Record<string, { source: string; sourceTitle: string; text: string }[]>;
};

function extractTagsFromLines(lines: string[]): string[] {
  if (lines[0]?.trim() !== "---") return [];
  const end = lines.indexOf("---", 1);
  if (end === -1) return [];
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^tags:\s*\[(.+)\]/);
    if (m) return m[1].split(",").map((t) => t.trim().replace(/["']/g, "")).filter(Boolean);
  }
  return [];
}

async function walkDir(dir: string, baseDir: string, results: FileDoc[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      await walkDir(full, baseDir, results);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const rel = path.relative(baseDir, full);
      const raw = await readFile(full, "utf8");
      const lines = raw.split("\n");
      let title = entry.name.replace(/\.md$/, "");
      let bodyStart = 0;
      const tags = extractTagsFromLines(lines);
      if (lines[0]?.trim() === "---") {
        const end = lines.indexOf("---", 1);
        if (end !== -1) {
          for (let i = 1; i < end; i++) {
            const m = lines[i].match(/^title:\s*(.+)/);
            if (m) { title = m[1].replace(/^["']|["']$/g, ""); break; }
          }
          bodyStart = end + 1;
        }
      }
      const body = lines.slice(bodyStart).join("\n").replace(/[#*_`>\[\]()\-|]/g, " ").replace(/\s+/g, " ").trim();
      const excerpt = body.slice(0, 300);
      const text = body.slice(0, 5000);
      results.push({ id: rel.replace(/[/\\]/g, "-").replace(/\.md$/, ""), title, path: rel, excerpt, text, tags });
    }
  }
}

export async function buildSearchIndex(outputDir: string): Promise<void> {
  const ssot = ssotPath();
  const docs: FileDoc[] = [];
  await walkDir(path.join(ssot, "_knowledge"), ssot, docs);
  await walkDir(path.join(ssot, "_archive"), ssot, docs);
  docs.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  const out = path.join(outputDir, "search-index.json");
  await writeFile(out, JSON.stringify(docs, null, 2) + "\n", "utf8");
  console.log(`build:data search-index: ${docs.length} docs indexed`);
}

// --- Chunk index ---

async function walkChunks(dir: string, baseDir: string, results: SearchChunk[], domainName: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      await walkChunks(full, baseDir, results, domainName);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const rel = path.relative(baseDir, full);
      const raw = await readFile(full, "utf8");
      const lines = raw.split("\n");
      let title = entry.name.replace(/\.md$/, "");
      let bodyStart = 0;
      const tags = extractTagsFromLines(lines);
      if (lines[0]?.trim() === "---") {
        const end = lines.indexOf("---", 1);
        if (end !== -1) {
          for (let i = 1; i < end; i++) {
            const m = lines[i].match(/^title:\s*(.+)/);
            if (m) { title = m[1].replace(/^["']|["']$/g, ""); break; }
          }
          bodyStart = end + 1;
        }
      }

      const bodyLines = lines.slice(bodyStart);
      const chunks = splitIntoChunks(bodyLines, title, rel, tags, domainName);
      for (const c of chunks) results.push(c);
    }
  }
}

function splitIntoChunks(
  bodyLines: string[],
  docTitle: string,
  filePath: string,
  tags: string[],
  domain: string,
): SearchChunk[] {
  const rawText = bodyLines.join("\n");
  const headingRe = /^#{2,4}\s+(.+)$/gm;
  const sections: { heading: string; body: string }[] = [];

  let lastIdx = 0;
  let lastHeading = "概述";
  let match: RegExpExecArray | null;

  headingRe.lastIndex = 0;
  while ((match = headingRe.exec(rawText)) !== null) {
    const start = match.index;
    if (start > lastIdx) {
      const sectionBody = rawText.slice(lastIdx, start).trim();
      if (sectionBody) sections.push({ heading: lastHeading, body: sectionBody });
    }
    lastIdx = start;
    lastHeading = match[1].trim();
  }
  const remaining = rawText.slice(lastIdx).trim();
  if (remaining) sections.push({ heading: lastHeading, body: remaining });

  if (sections.length === 0) {
    const cleaned = rawText.replace(/[#*_`>\[\]()\-|]/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length > 50) {
      const docId = filePath.replace(/[/\\]/g, "-").replace(/\.md$/, "");
      return [{ id: `${docId}--chunk-0`, docTitle, chunkHeading: "概述", path: filePath, text: cleaned.slice(0, 1000), tags, domain }];
    }
    return [];
  }

  const result: SearchChunk[] = [];
  const docId = filePath.replace(/[/\\]/g, "-").replace(/\.md$/, "");
  let chunkIdx = 0;

  for (const section of sections) {
    const cleaned = section.body.replace(/[#*_`>\[\]()\-|]/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length < 30) continue;

    if (cleaned.length <= 1000) {
      result.push({
        id: `${docId}--chunk-${chunkIdx++}`,
        docTitle,
        chunkHeading: section.heading,
        path: filePath,
        text: cleaned,
        tags,
        domain,
      });
    } else {
      const paras = cleaned.split(/\n{2,}/).filter((p) => p.trim().length > 20);
      let buffer = "";
      for (const para of paras) {
        if (buffer.length + para.length < 800 && buffer) {
          buffer += "\n" + para;
        } else {
          if (buffer) {
            result.push({
              id: `${docId}--chunk-${chunkIdx++}`,
              docTitle,
              chunkHeading: section.heading,
              path: filePath,
              text: buffer.trim(),
              tags,
              domain,
            });
          }
          buffer = para;
        }
      }
      if (buffer) {
        result.push({
          id: `${docId}--chunk-${chunkIdx++}`,
          docTitle,
          chunkHeading: section.heading,
          path: filePath,
          text: buffer.trim(),
          tags,
          domain,
        });
      }
    }
  }

  return result;
}

export async function buildChunkIndex(outputDir: string): Promise<void> {
  const ssot = ssotPath();
  const chunks: SearchChunk[] = [];
  await walkChunks(path.join(ssot, "_knowledge"), ssot, chunks, "knowledge");
  await walkChunks(path.join(ssot, "_archive"), ssot, chunks, "archive");
  const out = path.join(outputDir, "search-chunks.json");
  await writeFile(out, JSON.stringify(chunks, null, 2) + "\n", "utf8");
  console.log(`build:data search-chunks: ${chunks.length} chunks from ${new Set(chunks.map((c) => c.path)).size} docs`);
}

// --- Tag index ---

export async function buildTagIndex(outputDir: string): Promise<void> {
  const ssot = ssotPath();
  const docs: FileDoc[] = [];
  await walkDir(path.join(ssot, "_knowledge"), ssot, docs);
  await walkDir(path.join(ssot, "_archive"), ssot, docs);

  const index: TagIndex = { tags: {}, docs: {} };
  for (const doc of docs) {
    index.docs[doc.id] = { title: doc.title, path: doc.path, tags: doc.tags };
    for (const tag of doc.tags) {
      if (!index.tags[tag]) index.tags[tag] = { count: 0, docIds: [] };
      index.tags[tag].count++;
      index.tags[tag].docIds.push(doc.id);
    }
  }

  const sorted: Record<string, TagIndex["tags"][string]> = {};
  for (const tag of Object.keys(index.tags).sort((a, b) => a.localeCompare(b, "zh-CN"))) {
    sorted[tag] = index.tags[tag];
  }
  index.tags = sorted;

  const out = path.join(outputDir, "tags.json");
  await writeFile(out, JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log(`build:data tag-index: ${Object.keys(index.tags).length} unique tags, ${docs.filter((d) => d.tags.length > 0).length} tagged docs`);
}

// --- Links index ---

export async function buildLinksIndex(outputDir: string): Promise<void> {
  const ssot = ssotPath();
  const docs: FileDoc[] = [];
  await walkDir(path.join(ssot, "_knowledge"), ssot, docs);
  await walkDir(path.join(ssot, "_archive"), ssot, docs);

  const docByPath: Record<string, FileDoc> = {};
  for (const doc of docs) docByPath[doc.path] = doc;

  const allLinks: LinkIndex["links"] = {};
  const allBacklinks: LinkIndex["backlinks"] = {};

  for (const doc of docs) {
    const fp = path.join(ssot, doc.path);
    let raw: string;
    try {
      raw = await readFile(fp, "utf8");
    } catch { continue; }

    const refs: { text: string; target: string }[] = [];

    const body = raw.replace(/---[\s\S]*?---\n?/, "");

    const wikiRe = /\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = wikiRe.exec(body)) !== null) {
      refs.push({ text: m[1], target: m[1] });
    }

    const mdRe = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((m = mdRe.exec(body)) !== null) {
      const target = m[2].replace(/\.md$/, "");
      const resolved = path.resolve(path.dirname(doc.path), m[2]);
      const relative = path.relative("", resolved).replace(/\.md$/, "");
      refs.push({ text: m[1], target: relative });
      if (relative !== target) {
        refs.push({ text: m[1], target });
      }
    }

    for (const ref of refs) {
      if (!allLinks[doc.id]) allLinks[doc.id] = [];
      allLinks[doc.id].push({
        source: doc.path,
        sourceTitle: doc.title,
        target: ref.target,
        targetTitle: ref.target,
        text: ref.text,
      });

      const targetId = ref.target.replace(/[/\\]/g, "-");
      if (!allBacklinks[targetId]) allBacklinks[targetId] = [];
      allBacklinks[targetId].push({
        source: doc.path,
        sourceTitle: doc.title,
        text: ref.text,
      });
    }
  }

  const out = path.join(outputDir, "links.json");
  await writeFile(out, JSON.stringify({ links: allLinks, backlinks: allBacklinks }, null, 2) + "\n", "utf8");

  const totalLinks = Object.values(allLinks).reduce((s, v) => s + v.length, 0);
  const totalBacklinkTargets = Object.keys(allBacklinks).length;
  console.log(`build:data links-index: ${totalLinks} links, ${totalBacklinkTargets} backlink targets`);
}
