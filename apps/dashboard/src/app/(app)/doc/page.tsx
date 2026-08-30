import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSsotRoot, resolveSsotPath } from "@/lib/ssot";
import { extractSummaryFromMarkdown, stripFrontmatter } from "@/lib/extract";
import { DocAiSummary } from "@/components/shared/DocAiSummary";
import { MermaidDoc } from "@/components/shared/MermaidDoc";
import { DocImagePreview } from "@/components/shared/DocImagePreview";
import { marked } from "marked";
import { Card } from "@/components/shared/Card";

export const dynamic = "force-dynamic";

type TagIndex = {
  tags: Record<string, { count: number; docIds: string[] }>;
  docs: Record<string, { title: string; path: string; tags: string[] }>;
};

async function loadTagIndex(): Promise<TagIndex> {
  try {
    const raw = await readFile(path.join(process.cwd(), "app-data", "tags.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { tags: {}, docs: {} };
  }
}

async function findTagsForPath(relPath: string): Promise<string[]> {
  if (!relPath) return [];
  const { docs } = await loadTagIndex();
  const docId = relPath.replace(/[/\\]/g, "-").replace(/\.md$/, "");
  return docs[docId]?.tags ?? [];
}

type LinksIndex = {
  links: Record<string, { source: string; sourceTitle: string; target: string; targetTitle: string; text: string }[]>;
  backlinks: Record<string, { source: string; sourceTitle: string; text: string }[]>;
};

async function loadLinksIndex(): Promise<LinksIndex> {
  try {
    const raw = await readFile(path.join(process.cwd(), "app-data", "links.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { links: {}, backlinks: {} };
  }
}

async function findBacklinksForPath(relPath: string): Promise<{ source: string; sourceTitle: string; text: string }[]> {
  if (!relPath) return [];
  const { backlinks } = await loadLinksIndex();
  const docId = relPath.replace(/[/\\]/g, "-").replace(/\.md$/, "");
  return backlinks[docId] || [];
}

async function findRelatedDocs(relPath: string, docTags: string[], limit = 5): Promise<{ path: string; title: string; sharedTags: number }[]> {
  if (!relPath || docTags.length === 0) return []
  try {
    const tagIndex = await loadTagIndex()
    const scored: { path: string; title: string; sharedTags: number }[] = []
    for (const [, doc] of Object.entries(tagIndex.docs || {})) {
      if (doc.path === relPath) continue
      const shared = doc.tags.filter(t => docTags.includes(t)).length
      if (shared > 0) {
        scored.push({ path: doc.path, title: doc.title, sharedTags: shared })
      }
    }
    scored.sort((a, b) => b.sharedTags - a.sharedTags)
    return scored.slice(0, limit)
  } catch {
    return []
  }
}

type SearchParams = {
  path?: string | string[];
  raw?: string | string[];
};

function getFirstString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

const MAX_CHARS = 200_000;

export default async function DocPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedParams = await searchParams;
  const rel = getFirstString(resolvedParams?.path) || "";
  const rawMode = resolvedParams?.raw === "1";
  const resolved = resolveSsotPath(rel);
  const ssotRoot = getSsotRoot();

  if (!resolved) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">源文件</h1>
        <p className="text-sm" style={{ color: "var(--family-danger)" }}>
          路径不合法
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold no-underline"
          style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
        >
          返回首页
        </Link>
      </div>
    );
  }

  let content = "";
  let error: string | null = null;
  try {
    content = await readFile(resolved, "utf8");
  } catch (e) {
    error = e instanceof Error ? e.message : "读取失败";
  }

  const displayRel = path.relative(ssotRoot, resolved);
  const isMarkdown = /\.md$/i.test(resolved);
  const docTags = await findTagsForPath(rel);
  const relatedDocs = await findRelatedDocs(rel, docTags);
  const backlinks = await findBacklinksForPath(rel);

  const wordCount = content ? stripFrontmatter(content).split(/\s+/).filter(Boolean).length : 0;
  const headings = content
    ? stripFrontmatter(content)
        .split("\n")
        .filter((l) => l.startsWith("## "))
        .map((l) => l.replace(/^##\s+/, "").trim())
    : [];

  let processedHtml = "";
  if (isMarkdown && content) {
    const body = stripFrontmatter(content);
    const renderer = new marked.Renderer();
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      if (lang === "mermaid") {
        return `<div class="mermaid">${text}</div>\n`;
      }
      const langClass = lang ? ` class="language-${lang}"` : "";
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre><code${langClass}>${escaped}</code></pre>\n`;
    };
    processedHtml = marked.parse(body, { async: false, renderer }) as string;
  }

  return (
    <div className="space-y-5">
      {/* Metadata card */}
      <Card padding="none">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-snug" style={{ color: "var(--family-text)" }}>
                {rel.endsWith(".md") ? path.basename(resolved).replace(/\.md$/, "") : "源文件"}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--family-text-3)" }}>
                <span className="truncate max-w-[400px]" title={displayRel || rel}>
                  {displayRel || rel}
                </span>
                <span className="shrink-0">{wordCount} 字</span>
                {headings.length > 0 && <span className="shrink-0">{headings.length} 节</span>}
              </div>
              {docTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {docTags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tags/${encodeURIComponent(tag)}`}
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium no-underline family-transition"
                      style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isMarkdown && (
                rawMode ? (
                  <Link
                    href={`/doc?path=${encodeURIComponent(rel)}`}
                    className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface)",
                      color: "var(--family-primary)",
                    }}
                  >
                    渲染
                  </Link>
                ) : (
                  <Link
                    href={`/doc?path=${encodeURIComponent(rel)}&raw=1`}
                    className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface)",
                      color: "var(--family-text-2)",
                    }}
                  >
                    源码
                  </Link>
                )
              )}
              <Link
                href="/"
                className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline"
                style={{
                  borderColor: "var(--family-border)",
                  background: "var(--family-surface)",
                  color: "var(--family-text-2)",
                }}
              >
                首页
              </Link>
            </div>
          </div>
        </div>

        {/* Section headings preview */}
        {headings.length > 0 && (
          <div className="border-t px-5 py-3" style={{ borderColor: "var(--family-border)" }}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--family-text-3)" }}>
                章节
              </span>
              {headings.map((h, i) => (
                <span key={i} className="text-xs" style={{ color: "var(--family-text-2)" }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* AI Summary */}
      {isMarkdown && content && (
        <DocAiSummary docPath={rel} fallbackSummary={extractSummaryFromMarkdown(content, 150) || ""} />
      )}

      {/* Error / Content */}
      {error ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(185, 88, 82, 0.35)",
            background: "rgba(185, 88, 82, 0.10)",
            color: "var(--family-danger)",
          }}
        >
          {error}
        </div>
      ) : rawMode || !isMarkdown ? (
        <pre
          className="rounded-2xl border p-4 text-xs leading-relaxed sm:text-sm"
          style={{
            borderColor: "var(--family-border)",
            background: "var(--family-surface)",
            color: "var(--family-text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content.length > MAX_CHARS
            ? content.slice(0, MAX_CHARS) + "\n…(truncated)\n"
            : content}
        </pre>
      ) : (
        <div
          className="rounded-2xl border p-6 sm:p-8"
          style={{
            borderColor: "var(--family-border)",
            background: "var(--family-surface)",
          }}
        >
          <DocImagePreview><MermaidDoc html={processedHtml} /></DocImagePreview>
        </div>
      )}

      {/* Backlinks + Graph */}
      <div className="flex items-start gap-3 flex-wrap">
        {backlinks.length > 0 && (
          <Card style={{ flex: 1, minWidth: 280 }}>
            <h2 className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--family-text)" }}>
              <span>🔗</span> 被引用（{backlinks.length} 处）
            </h2>
            <div className="flex flex-col gap-2">
              {backlinks.map((bl, i) => (
                <Link
                  key={i}
                  href={`/doc?path=${encodeURIComponent(bl.source)}`}
                  className="flex items-center gap-2 no-underline rounded-lg px-2 py-1.5 family-transition doc-backlink"
                  style={{ color: "var(--family-text-2)", fontSize: "0.8125rem" }}
                >
                  <span className="shrink-0">📄</span>
                  <span className="font-semibold">{bl.sourceTitle}</span>
                  <span className="truncate min-w-0" style={{ color: "var(--family-text-3)" }}>
                    &ldquo;{bl.text}&rdquo;
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
        <Link
          href={`/graph?highlight=${encodeURIComponent(rel)}`}
          className="inline-flex items-center gap-1.5 rounded-2xl border px-4 py-3 text-xs font-semibold no-underline family-transition shrink-0 doc-graph-btn"
          style={{
            borderColor: "var(--family-border)",
            background: "var(--family-surface)",
            color: "var(--family-text-2)",
          }}
        >
          <span>🕸️</span> 查看图谱
        </Link>
      </div>

      {/* Related docs */}
      {relatedDocs.length > 0 && (
        <Card>
          <h2 className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--family-text)" }}>
            <span>📎</span> 相关文档
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedDocs.map((rd, i) => (
              <Link
                key={i}
                href={`/doc?path=${encodeURIComponent(rd.path)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium no-underline family-transition"
                style={{
                  borderColor: "var(--family-border)",
                  background: "var(--family-surface-2)",
                  color: "var(--family-text-2)",
                }}
              >
                <span>📄</span>
                <span>{rd.title}</span>
                <span style={{ color: "var(--family-text-3)" }}>· {rd.sharedTags} 标签</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <style>{`
        .doc-backlink:hover { background: var(--family-surface-2) !important; }
        .doc-graph-btn:hover { background: var(--family-surface-2) !important; }
      `}</style>
    </div>
  );
}
