"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card } from "@/components/shared/Card";

const KnowledgeGraph = dynamic(
  () => import("@/components/shared/KnowledgeGraph").then((m) => ({ default: m.KnowledgeGraph })),
  { ssr: false }
);

function GraphContent() {
  const searchParams = useSearchParams();
  const highlight = searchParams?.get("highlight") || undefined;

  return (
    <>
      <div className="mb-4">
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
          🕸️ 知识图谱
        </h1>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
          文档间引用关系可视化 · 节点大小表示连接数 · 颜色按领域区分
        </p>
        {highlight && (
          <Link
            href={`/doc?path=${encodeURIComponent(highlight)}`}
            className="inline-flex items-center gap-1 mt-2 text-xs no-underline"
            style={{ color: "var(--family-primary)" }}
          >
            ← 查看原文档
          </Link>
        )}
      </div>

      <Card padding="none">
        <KnowledgeGraph height={600} highlightId={highlight} />
      </Card>
    </>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center" style={{ height: 400, color: "var(--family-text-3)" }}>
        <span className="text-xs">加载中…</span>
      </div>
    }>
      <GraphContent />
    </Suspense>
  );
}
