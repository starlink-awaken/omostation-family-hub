import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/shared/Card";

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

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const { tags, docs } = await loadTagIndex();
  const tagInfo = tags[decoded];

  if (!tagInfo) notFound();

  const taggedDocs = tagInfo.docIds
    .map((id) => docs[id])
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));

  return (
    <>
      <div className="mb-5">
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-xs no-underline family-transition mb-2"
          style={{ color: "var(--family-text-3)" }}
        >
          ← 所有标签
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold mb-0" style={{ color: "var(--family-text)" }}>
            🏷️ {decoded}
          </h1>
          <span
            className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}
          >
            {tagInfo.count} 篇
          </span>
        </div>
      </div>

      {taggedDocs.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-sm mb-0" style={{ color: "var(--family-text-2)" }}>
            暂无文档。
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {taggedDocs.map((doc) => (
            <Link
              key={doc.path}
              href={`/doc?path=${encodeURIComponent(doc.path)}`}
              className="rounded-xl border no-underline family-transition"
              style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
            >
              <div style={{ padding: "1rem" }}>
                <div className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      background: "var(--family-surface-2)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold mb-1" style={{ color: "var(--family-text)" }}>
                      {doc.title}
                    </div>
                    <div className="text-xs mb-1.5 truncate" style={{ color: "var(--family-text-3)" }}>
                      {doc.path}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const other = doc.tags.filter((t) => t !== decoded);
                        const shown = other.slice(0, 4);
                        const remain = other.length - shown.length;
                        return (
                          <>
                            {shown.map((t) => (
                              <span
                                key={t}
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: "var(--family-surface-2)", color: "var(--family-text-3)" }}
                              >
                                {t}
                              </span>
                            ))}
                            {remain > 0 && (
                              <span className="text-xs" style={{ color: "var(--family-text-3)" }}>
                                +{remain}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
