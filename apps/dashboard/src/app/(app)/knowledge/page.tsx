import Link from "next/link";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getSsotRoot } from "@/lib/ssot";
import { statePath } from "@/lib/paths";
import { scannablePaths } from "@/lib/task-extractor";

export const dynamic = "force-dynamic";

type KbStats = {
  totalDocs: number;
  totalTags: number;
  totalLinks: number;
  topTags: { name: string; count: number }[];
  topLinked: { path: string; title: string; count: number }[];
  orphanDocs: { path: string; title: string }[];
  recentChanges: number;
};

async function getKbStats(): Promise<KbStats> {
  const appData = statePath("generated");
  let totalTags = 0;
  let topTags: { name: string; count: number }[] = [];
  let allDocPaths: string[] = [];
  const docMap: Record<string, string> = {};

  try {
    const raw = await readFile(path.join(appData, "tags.json"), "utf8");
    const tagIndex = JSON.parse(raw);
    totalTags = Object.keys(tagIndex.tags || {}).length;
    topTags = (Object.entries(tagIndex.tags || {}) as [string, { count: number }][])
      .map(([name, v]) => ({ name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    allDocPaths = (Object.values(tagIndex.docs || {}) as { path: string }[]).map((d) => d.path);
    for (const [, d] of Object.entries(tagIndex.docs || {})) {
      const doc = d as { path: string; title: string };
      docMap[doc.path] = doc.title;
    }
  } catch {}

  let totalLinks = 0;
  let topLinked: { path: string; title: string; count: number }[] = [];
  let orphanDocs: { path: string; title: string }[] = [];

  try {
    const raw = await readFile(path.join(appData, "links.json"), "utf8");
    const linkIndex = JSON.parse(raw);
    const backlinks = linkIndex.backlinks || {};
    totalLinks = (Object.values(backlinks) as unknown[][]).reduce((s, arr) => s + arr.length, 0);
    topLinked = (Object.entries(backlinks) as [string, unknown[]][])
      .map(([docId, arr]) => {
        const docPath = docId.replace(/-/g, "/") + ".md";
        return {
          path: docPath,
          title: docMap[docPath] || docPath.split("/").pop()?.replace(/\.md$/, "") || docPath,
          count: arr.length,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const referenced = new Set(Object.keys(backlinks));
    orphanDocs = allDocPaths
      .filter((p) => !p.includes("storage/") && !p.includes("99-中转") && !p.includes("_meta/") && !p.includes("_control/"))
      .filter((p) => {
        const docId = p.replace(/[/\\]/g, "-").replace(/\.md$/, "");
        return !referenced.has(docId);
      })
      .map((p) => ({
        path: p,
        title: docMap[p] || p.split("/").pop()?.replace(/\.md$/, "") || p,
      }))
      .slice(0, 20);
  } catch {}

  let totalDocs = 0;
  try {
    const raw = await readFile(path.join(appData, "search-index.json"), "utf8");
    const docs = JSON.parse(raw);
    totalDocs = Array.isArray(docs) ? docs.length : 0;
  } catch {
    totalDocs = allDocPaths.length;
  }

  let recentChanges = 0;
  try {
    const root = getSsotRoot();
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const dirs = scannablePaths();
    async function scanDirForRecent(dirPath: string) {
      let entries;
      try {
        entries = await readdir(dirPath, { withFileTypes: true });
      } catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDirForRecent(full);
        } else if (entry.name.endsWith(".md")) {
          try {
            const s = await stat(full);
            if (now - s.mtimeMs < TWENTY_FOUR_HOURS) recentChanges++;
          } catch {}
        }
      }
    }
    for (const dir of dirs) {
      await scanDirForRecent(path.join(root, dir));
    }
  } catch {}

  return { totalDocs, totalTags, totalLinks, topTags, topLinked, orphanDocs, recentChanges };
}

function StatGrid({ stats }: { stats: KbStats }) {
  const items = [
    { value: stats.totalDocs, label: "文档", icon: "📄", color: "var(--family-primary)" },
    { value: stats.totalTags, label: "标签", icon: "🏷️", color: "var(--family-info)" },
    { value: stats.totalLinks, label: "引用", icon: "🔗", color: "var(--family-warning)" },
    { value: stats.recentChanges, label: "今日变更", icon: "🔄", color: "var(--family-success)" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {items.map((it) => (
        <div key={it.label} className="stat-card">
          <div className="stat-card-body">
            <span className="text-base mb-1 block">{it.icon}</span>
            <div className="text-xl font-bold" style={{ color: it.color }}>
              {it.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--family-text-3)" }}>
              {it.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function KnowledgePage() {
  const stats = await getKbStats();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--family-text)" }}>
          📊 知识面板
        </h1>
        <p className="text-sm" style={{ color: "var(--family-text-3)" }}>
          知识库全局概览·共 {stats.totalDocs} 篇文档
        </p>
      </div>

      <StatGrid stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card-section">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">🔥</span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>热门文档</h2>
            <span className="text-xs ml-auto" style={{ color: "var(--family-text-3)" }}>
              按引用量排序
            </span>
          </div>
          {stats.topLinked.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--family-text-3)" }}>
              暂无数据
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {stats.topLinked.map((doc, i) => (
                <Link
                  key={doc.path}
                  href={`/doc?path=${encodeURIComponent(doc.path)}`}
                  className="doc-link-row"
                >
                  <span className="doc-link-rank">{i + 1}</span>
                  <span className="flex-1 truncate text-sm">{doc.title}</span>
                  <span className="doc-link-count">{doc.count} 引用</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card-section">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">🏷️</span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>热门标签</h2>
          </div>
          {stats.topTags.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--family-text-3)" }}>
              暂无数据
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map((tag) => (
                <Link
                  key={tag.name}
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                  className="tag-pill-link"
                >
                  <span>{tag.name}</span>
                  <span className="tag-pill-count">{tag.count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {stats.orphanDocs.length > 0 && (
        <div className="card-section">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">🏝️</span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>孤岛文档</h2>
            <span className="text-xs ml-auto" style={{ color: "var(--family-text-3)" }}>
              未被任何文档引用 · 共 {stats.orphanDocs.length} 篇
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.orphanDocs.map((doc) => (
              <Link
                key={doc.path}
                href={`/doc?path=${encodeURIComponent(doc.path)}`}
                className="orphan-doc-link"
              >
                📄 {doc.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
