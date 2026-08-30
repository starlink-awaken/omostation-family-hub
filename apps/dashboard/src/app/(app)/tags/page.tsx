import { readFile } from "node:fs/promises";
import Link from "next/link";
import { Card } from "@/components/shared/Card";
import { statePath } from "@/lib/paths";

export const dynamic = "force-dynamic";

type TagIndex = {
  tags: Record<string, { count: number; docIds: string[] }>;
};

async function loadTagIndex(): Promise<TagIndex> {
  try {
    const raw = await readFile(statePath("generated", "tags.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return { tags: {} };
  }
}

const TAG_HUES = [160, 210, 42, 10, 260, 140, 50, 200, 100, 30, 180, 220];

function hsl(index: number, sat = 48, light = 86): string {
  return `hsl(${TAG_HUES[index % TAG_HUES.length]}, ${sat}%, ${light}%)`;
}

function hslText(index: number, light = 32): string {
  return `hsl(${TAG_HUES[index % TAG_HUES.length]}, 40%, ${light}%)`;
}

export default async function TagsPage() {
  const { tags } = await loadTagIndex();
  const entries = Object.entries(tags).sort((a, b) => b[1].count - a[1].count);
  const maxCount = entries.length > 0 ? entries[0][1].count : 1;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
          🏷️ 标签
        </h1>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
          {entries.length} 个标签 · 按文档标注分类浏览 · 标签大小代表文档数量
        </p>
      </div>

      {entries.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-sm mb-0" style={{ color: "var(--family-text-2)" }}>
            暂无标签数据。
          </p>
        </Card>
      ) : (
        <Card padding="lg">
          <div className="flex flex-wrap items-center justify-center gap-3 leading-none">
            {entries.map(([tag, info], i) => {
              const ratio = info.count / maxCount;
              const fontSize = ratio > 0.8 ? "1.25rem" : ratio > 0.5 ? "1.05rem" : ratio > 0.25 ? "0.9rem" : "0.78rem";
              const padX = ratio > 0.5 ? "px-4" : "px-3";
              const padY = ratio > 0.5 ? "py-2" : "py-1.5";
              const weight = ratio > 0.4 ? 600 : 500;
              const bg = hsl(i);
              const fg = hslText(i);
              return (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className={`inline-flex items-center gap-1.5 rounded-full no-underline tag-pill ${padX} ${padY}`}
                  style={{
                    fontSize,
                    fontWeight: weight,
                    color: fg,
                    background: bg,
                    boxShadow: `0 0 0 ${bg}`,
                  }}
                >
                  <span>{tag}</span>
                  <span
                    className="inline-flex items-center justify-center rounded-full shrink-0"
                    style={{
                      minWidth: ratio > 0.3 ? 20 : 18,
                      height: ratio > 0.3 ? 20 : 18,
                      padding: "0 5px",
                      fontSize: ratio > 0.8 ? "0.7rem" : "0.6rem",
                      fontWeight: 600,
                      background: fg,
                      color: bg,
                      lineHeight: 1,
                    }}
                  >
                    {info.count}
                  </span>
                </Link>
              );
            })}
          </div>
          <style>{`
            .tag-pill {
              transition: all 0.2s ease;
              transform: translateY(0);
            }
            .tag-pill:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 14px rgba(0,0,0,0.08) !important;
            }
          `}</style>
        </Card>
      )}
    </>
  );
}
