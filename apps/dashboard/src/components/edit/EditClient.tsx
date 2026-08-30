"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { csrfHeaders } from "@/lib/csrf";

type TreeNode = {
  name: string;
  type: "dir" | "file";
  path: string;
  kind?: "md" | "image";
  count?: number;
  children?: TreeNode[];
};

export function EditClient() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  const [filePath, setFilePath] = useState("");
  const [content, setContent] = useState("");
  const [origContent, setOrigContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [treeSearch, setTreeSearch] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/file-tree");
      if (!res.ok) return;
      const data = await res.json();
      setTree(data.knowledge || []);
      if (data.archive?.length) {
        setTree((prev) => [
          ...prev,
          { name: "_archive", type: "dir" as const, path: "_archive", children: data.archive },
        ]);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTree();
  }, [fetchTree]);

  const loadFile = useCallback(async (relPath: string) => {
    setFilePath(relPath);
    setSaveMsg("");
    try {
      const res = await fetch("/api/file/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: relPath }),
      });
      if (!res.ok) {
        setContent(`// 读取失败: ${relPath}`);
        setOrigContent("");
        return;
      }
      const data = await res.json();
      setContent(data.content);
      setOrigContent(data.content);
    } catch {
      setContent("// 读取失败");
      setOrigContent("");
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!filePath || saving) return;
    setSaving(true);
    setSaveMsg("保存中…");
    try {
      const res = await fetch("/api/file/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ path: filePath, content }),
      });
      if (!res.ok) throw new Error((await res.text()) || "保存失败");
      setOrigContent(content);
      setSaveMsg("✅ 已保存");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveMsg(`❌ ${err instanceof Error ? err.message : "保存失败"}`);
    } finally {
      setSaving(false);
    }
  }, [filePath, content, saving]);

  const handleRebuild = useCallback(async () => {
    setRebuilding(true);
    setRebuildMsg("重建中…");
    try {
      const res = await fetch("/api/rebuild", { method: "POST", headers: csrfHeaders() });
      if (!res.ok) throw new Error("重建失败");
      setRebuildMsg("✅ 重建完成");
      setTimeout(() => setRebuildMsg(""), 4000);
    } catch {
      setRebuildMsg("❌ 重建失败");
    } finally {
      setRebuilding(false);
    }
  }, []);

  const toggleDir = useCallback((dirPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  }, []);

  const hasChanges = content !== origContent;

  const handleKeydown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  const handleNewFile = useCallback(async (dirPath: string) => {
    const name = prompt("文件名（.md）:", "新文档.md");
    if (!name) return;
    const relPath = dirPath ? `${dirPath}/${name}` : name;
    const res = await fetch("/api/file/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ path: relPath, content: `# ${name.replace(/\.md$/, "")}\n\n` }),
    });
    if (res.ok) {
      setFilePath(relPath);
      setContent(`# ${name.replace(/\.md$/, "")}\n\n`);
      setOrigContent(`# ${name.replace(/\.md$/, "")}\n\n`);
      setSaveMsg("✅ 已创建");
      setTimeout(() => setSaveMsg(""), 3000);
      fetchTree();
    } else {
      setSaveMsg("❌ 创建失败");
    }
  }, [fetchTree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "60vh" }}>
        <p className="text-sm" style={{ color: "var(--family-text-3)" }}>加载中…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ overflow: "hidden" }}>

      {/* Sidebar */}
      <div
        className="border-end flex flex-col shrink-0 family-transition"
        style={{
          width: sidebarOpen ? 280 : 0,
          minWidth: sidebarOpen ? 280 : 0,
          overflow: "hidden",
          background: "var(--family-surface)",
        }}
      >
        <div className="p-3 border-b flex items-center gap-2">
          <span className="text-sm font-semibold shrink-0">📁 文件</span>
          <input
            type="text"
            placeholder="筛选…"
            value={treeSearch}
            onChange={(e) => setTreeSearch(e.target.value)}
            className="text-xs border-0 bg-transparent outline-none flex-1 min-w-0"
            style={{ color: "var(--family-text-2)" }}
          />
          <button
            onClick={() => handleNewFile("")}
            className="border-0 bg-transparent p-0 flex items-center shrink-0"
            style={{ color: "var(--family-text-3)", cursor: "pointer" }}
            title="新建文件"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </button>
          <button
            onClick={fetchTree}
            className="border-0 bg-transparent p-0 flex items-center shrink-0"
            style={{ color: "var(--family-text-3)", cursor: "pointer" }}
            title="刷新"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2" style={{ fontSize: 13 }}>
          {renderTree(tree, { expanded, toggleDir, loadFile, currentPath: filePath, search: treeSearch })}
        </div>
        <div className="p-3 border-top">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="w-full border-0 rounded-lg px-3 py-1.5 text-xs font-semibold family-transition"
            style={{
              background: rebuilding ? "var(--family-text-3)" : "var(--family-primary)",
              color: "#fff",
              cursor: rebuilding ? "not-allowed" : "pointer",
            }}
          >
            {rebuilding ? "重建中…" : "🔄 重建索引"}
          </button>
          {rebuildMsg && (
            <div className="text-xs mt-1.5 text-center" style={{ color: rebuildMsg.startsWith("✅") ? "#2e7d32" : "#a04844" }}>
              {rebuildMsg}
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ background: "var(--family-surface)", minHeight: 44 }}>
          <button
             onClick={() => setSidebarOpen((v) => !v)}
             className="border-0 bg-transparent flex items-center justify-center shrink-0 family-transition"
             style={{
               width: 32,
               height: 32,
               borderRadius: 8,
               color: "var(--family-text-3)",
               cursor: "pointer",
             }}
             onMouseEnter={(e) => (e.currentTarget.style.background = "var(--family-surface-2)")}
             onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
             title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
           >
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               {sidebarOpen ? (
                 <rect x="3" y="3" width="18" height="18" rx="2" />
               ) : (
                 <line x1="3" y1="6" x2="21" y2="6" />
               )}
               {sidebarOpen ? (
                 <line x1="9" y1="3" x2="9" y2="21" />
               ) : (
                 <line x1="3" y1="12" x2="21" y2="12" />
               )}
               {!sidebarOpen && <line x1="3" y1="18" x2="21" y2="18" />}
             </svg>
           </button>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium truncate" style={{ color: "var(--family-text-2)" }}>
              {filePath || "选择左侧文件开始编辑"}
            </span>
            {filePath && (
              <span className="text-[10px] ms-2" style={{ color: hasChanges ? "var(--family-primary)" : "var(--family-text-3)" }}>
                {hasChanges ? "⚠ 未保存" : "✓ 已同步"}
              </span>
            )}
          </div>
          {filePath && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="border-0 rounded-lg px-2 py-1 text-xs family-transition"
                style={{
                  background: showPreview ? "var(--family-primary-soft)" : "transparent",
                  color: showPreview ? "var(--family-primary)" : "var(--family-text-3)",
                  cursor: "pointer",
                }}
              >
                {showPreview ? "仅编辑" : "预览"}
              </button>
              {saveMsg && (
                <span className="text-xs" style={{ color: saveMsg.startsWith("✅") ? "#2e7d32" : "#a04844" }}>
                  {saveMsg}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="border-0 rounded-lg px-3 py-1.5 text-xs font-semibold family-transition"
                style={{
                  background: saving || !hasChanges ? "var(--family-text-3)" : "var(--family-primary)",
                  color: "#fff",
                  cursor: saving || !hasChanges ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "保存中…" : "💾 保存"}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {filePath ? (
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            <div className="flex-1 flex items-start justify-center" style={{ minHeight: 0 }}>
              <div className="flex h-full" style={{ maxWidth: 1600, width: "100%" }}>
                {!showPreview ? (
                  <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onKeyDown={handleKeydown}
                      className="w-full flex-1 border-0 p-4 outline-none resize-none"
                      style={{
                        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--family-text)",
                        background: "var(--family-bg)",
                        tabSize: 2,
                      }}
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full" style={{ minWidth: 0 }}>
                    <div className="flex-1 flex flex-col border-end" style={{ minWidth: 0, flex: "0 0 55%" }}>
                      <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeydown}
                        className="w-full flex-1 border-0 p-4 outline-none resize-none"
                        style={{
                          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: "var(--family-text)",
                          background: "var(--family-bg)",
                          tabSize: 2,
                        }}
                        spellCheck={false}
                      />
                    </div>
                    <div className="overflow-y-auto p-4" style={{ flex: "0 0 45%", background: "var(--family-bg)" }}>
                      <div
                        className="md-body"
                        style={{ fontSize: 14 }}
                        dangerouslySetInnerHTML={{
                          __html: marked.parse(content, { async: false }) as string,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--family-text-3)" }}>
                📝 选择左侧文件开始编辑
              </p>
              <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
                ⌘S 保存 · 支持 Markdown 语法
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderTree(
  nodes: TreeNode[],
  ctx: {
    expanded: Set<string>;
    toggleDir: (p: string) => void;
    loadFile: (p: string) => void;
    currentPath: string;
    search: string;
  }
): React.ReactNode {
  const q = ctx.search.toLowerCase().trim();
  const filtered = q
    ? nodes.filter((n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
    : nodes;

  return filtered.map((node) => {
    if (node.type === "dir") {
      const isExpanded = ctx.expanded.has(node.path);
      const isMatch = q && node.name.toLowerCase().includes(q);
      const childMatch =
        q &&
        node.children?.some(
          (c) => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q)
        );

      if (q && !isMatch && !childMatch) return null;

      return (
        <div key={node.path}>
          <button
            onClick={() => ctx.toggleDir(node.path)}
            className="w-full flex items-center gap-1 rounded-lg px-2 py-1 family-transition border-0 bg-transparent text-start"
            style={{ cursor: "pointer", color: "var(--family-text-2)", fontSize: 13 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--family-surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ flexShrink: 0, width: 14, textAlign: "center" }}>
              {isExpanded ? "▾" : "▸"}
            </span>
            <span className="flex-1 truncate">{node.name}</span>
            {node.count != null && (
              <span className="text-[10px]" style={{ color: "var(--family-text-3)" }}>
                {node.count}
              </span>
            )}
          </button>
          {isExpanded && node.children && (
            <div style={{ paddingLeft: 16 }}>
              {renderTree(node.children, ctx)}
            </div>
          )}
        </div>
      );
    }

    if (node.kind !== "md") return null;

    const isActive = node.path === ctx.currentPath;
    return (
      <button
        key={node.path}
        onClick={() => ctx.loadFile(node.path)}
        className="w-full flex items-center gap-1 rounded-lg px-2 py-1 family-transition border-0 bg-transparent text-start"
        style={{
          cursor: "pointer",
          color: isActive ? "var(--family-primary)" : "var(--family-text-2)",
          background: isActive ? "var(--family-primary-soft)" : "transparent",
          fontSize: 13,
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "var(--family-surface-2)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ flexShrink: 0, width: 14, textAlign: "center" }}>📄</span>
        <span className="flex-1 truncate">{node.name}</span>
      </button>
    );
  });
}
