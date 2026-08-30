"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/shared/Card";

type TreeNode = {
  name: string;
  type: "dir" | "file";
  path: string;
  kind?: "md" | "image";
  count?: number;
  children?: TreeNode[];
};

function ImageLightbox({ path: imgPath, onClose }: { path: string | null; onClose: () => void }) {
  if (!imgPath) return null;

  const src = `/api/file/${encodeURIComponent(imgPath)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", cursor: "zoom-out" }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute border-0 bg-transparent flex items-center justify-center"
        style={{
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: "1.25rem", cursor: "pointer", zIndex: 1,
        }}
        aria-label="关闭"
      >
        ✕
      </button>
      <img
        src={src}
        alt=""
        className="block"
        style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain", cursor: "default" }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function TreeView({
  nodes,
  depth = 0,
  onImageClick,
}: {
  nodes: TreeNode[];
  depth?: number;
  onImageClick: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <ul className="list-none mb-0" style={{ paddingLeft: depth > 0 ? "1.25rem" : 0 }}>
      {nodes.map((node) => {
        const key = node.path;
        const isCollapsed = collapsed[key];

        if (node.type === "dir") {
          return (
            <li key={key} className="mb-0.5">
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))}
                aria-label={isCollapsed ? `展开 ${node.name}` : `折叠 ${node.name}`}
                className="flex items-center gap-1.5 w-full text-left border-0 bg-transparent rounded px-2 py-1 family-transition"
                style={{ color: "var(--family-text-2)", fontSize: "0.8125rem" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--family-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ width: 14, textAlign: "center", flexShrink: 0 }}>
                  {isCollapsed ? "▸" : "▾"}
                </span>
                <span style={{ marginRight: 2 }}>📁</span>
                <span className="font-semibold">{node.name}</span>
                {node.count != null && (
                  <span className="text-xs ml-auto" style={{ color: "var(--family-text-3)" }}>{node.count}</span>
                )}
              </button>
              {!isCollapsed && node.children && (
                <TreeView nodes={node.children} depth={depth + 1} onImageClick={onImageClick} />
              )}
            </li>
          );
        }

        if (node.kind === "image") {
          const src = `/api/file/${encodeURIComponent(node.path)}`;
          return (
            <li key={key} className="mb-0.5">
              <button
                onClick={() => onImageClick(node.path)}
                className="flex items-center gap-1.5 w-full text-left border-0 bg-transparent rounded px-2 py-1 family-transition"
                style={{ color: "var(--family-text-2)", fontSize: "0.8125rem", paddingLeft: "2rem", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--family-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span
                  className="shrink-0 rounded overflow-hidden inline-flex items-center justify-center"
                  style={{ width: 24, height: 24, background: "var(--family-surface-2)", marginRight: 4 }}
                >
                  <img
                    src={src}
                    alt=""
                    className="block"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                </span>
                <span className="truncate">{node.name}</span>
              </button>
            </li>
          );
        }

        return (
          <li key={key} className="mb-0.5">
            <a
              href={`/doc?path=${encodeURIComponent(node.path)}`}
              className="flex items-center gap-1.5 no-underline rounded px-2 py-1 family-transition"
              style={{ color: "var(--family-text-2)", fontSize: "0.8125rem", paddingLeft: "2rem" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--family-surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ marginRight: 4 }}>📄</span>
              <span className="truncate">{node.name}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function FilesClient({
  knowledge,
  archive,
}: {
  knowledge: TreeNode[];
  archive: TreeNode[];
}) {
  const [lightboxPath, setLightboxPath] = useState<string | null>(null);

  const handleImageClick = useCallback((path: string) => {
    setLightboxPath(path);
  }, []);

  const countFiles = (nodes: TreeNode[]): number =>
    nodes.reduce((s, n) => s + (n.type === "file" ? 1 : (n.children ? countFiles(n.children) : 0)), 0);

  const knowledgeFiles = countFiles(knowledge);
  const archiveFiles = countFiles(archive);

  return (
    <>
      <ImageLightbox path={lightboxPath} onClose={() => setLightboxPath(null)} />

      <div className="mb-4">
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
          文件浏览
        </h1>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
          浏览知识库文件结构 · 点击文件查看内容 · 点击图片查看原图
        </p>
      </div>

      <section className="mb-4">
        <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--family-text)" }}>
          _knowledge（知识库）
          <span className="text-xs ml-2 font-normal" style={{ color: "var(--family-text-3)" }}>
            {knowledgeFiles} 项
          </span>
        </h2>
        <Card padding="sm">
          {knowledge.length > 0 ? (
            <TreeView nodes={knowledge} onImageClick={handleImageClick} />
          ) : (
            <p className="text-xs mb-0" style={{ color: "var(--family-text-3)" }}>暂无文件</p>
          )}
        </Card>
      </section>
      <section className="mb-4">
        <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--family-text)" }}>
          _archive（归档）
          <span className="text-xs ml-2 font-normal" style={{ color: "var(--family-text-3)" }}>
            {archiveFiles} 项
          </span>
        </h2>
        <Card padding="sm">
          {archive.length > 0 ? (
            <TreeView nodes={archive} onImageClick={handleImageClick} />
          ) : (
            <p className="text-xs mb-0" style={{ color: "var(--family-text-3)" }}>暂无文件</p>
          )}
        </Card>
      </section>
    </>
  );
}
