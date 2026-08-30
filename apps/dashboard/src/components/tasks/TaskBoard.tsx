"use client";

import { useState, useEffect, useCallback } from "react";

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  sourcePath: string;
  sourceTitle: string;
  domain: string;
  dueDate?: string;
}

interface TaskGroup {
  domain: string;
  pending: TaskItem[];
  done: TaskItem[];
}

const DOMAIN_ICONS: Record<string, string> = {
  members: "👤",
  health: "❤️",
  growth: "🌱",
  daily: "🏠",
  assets: "🏦",
  calendar: "📅",
  finance: "💰",
};

function domainIcon(domain: string): string {
  const key = Object.keys(DOMAIN_ICONS).find((k) => domain.includes(k));
  return DOMAIN_ICONS[key ?? ""] ?? "📋";
}

function TaskRow({ task, onToggle }: { task: TaskItem; onToggle: (id: string, done: boolean) => void }) {
  return (
    <label className="task-row">
      <div className="task-row-checkbox">
        <input
          type="checkbox"
          checked={task.done}
          onChange={() => onToggle(task.id, !task.done)}
          aria-label={task.text}
          className="task-checkbox"
        />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className="text-sm font-medium"
          style={{
            color: "var(--family-text)",
            textDecoration: task.done ? "line-through" : "none",
            opacity: task.done ? 0.5 : 1,
          }}
        >
          {task.text}
        </span>
        <span className="task-row-source">
          via {task.sourceTitle}
        </span>
      </div>
    </label>
  );
}

export function TaskBoard() {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data: { groups: TaskGroup[] } = await res.json();
      setGroups(data.groups);
    } catch {
      // keep previous state
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tasks", { signal: controller.signal })
      .then((response) => response.json() as Promise<{ groups: TaskGroup[] }>)
      .then((data) => setGroups(data.groups))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleToggle = useCallback(async (taskId: string, newDone: boolean) => {
    setGroups((prev) =>
      prev.map((g) => {
        let moved: TaskItem | null = null;
        const pending = [...g.pending];
        const done = [...g.done];

        if (newDone) {
          const idx = pending.findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            moved = { ...pending[idx], done: true };
            pending.splice(idx, 1);
            done.push(moved);
          }
        } else {
          const idx = done.findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            moved = { ...done[idx], done: false };
            done.splice(idx, 1);
            pending.push(moved);
          }
        }
        return { ...g, pending, done };
      })
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, done: newDone }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setGroups((prev) =>
        prev.map((g) => {
          let moved: TaskItem | null = null;
          const pending = [...g.pending];
          const done = [...g.done];

          if (!newDone) {
            const idx = pending.findIndex((t) => t.id === taskId);
            if (idx !== -1) {
              moved = { ...pending[idx], done: true };
              pending.splice(idx, 1);
              done.push(moved);
            }
          } else {
            const idx = done.findIndex((t) => t.id === taskId);
            if (idx !== -1) {
              moved = { ...done[idx], done: false };
              done.splice(idx, 1);
              pending.push(moved);
            }
          }
          return { ...g, pending, done };
        })
      );
    }
  }, []);

  const handleRebuild = useCallback(async () => {
    setRebuilding(true);
    try {
      await fetch("/api/tasks/rebuild", { method: "POST" });
      await fetchTasks();
    } catch {
      // ignore
    }
    setRebuilding(false);
  }, [fetchTasks]);

  const toggleCollapse = useCallback((domain: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const totalPending = groups.reduce((s, g) => s + g.pending.length, 0);
  const totalDone = groups.reduce((s, g) => s + g.done.length, 0);

  if (loading) {
    return (
      <div className="empty-card">
        <p className="text-sm" style={{ color: "var(--family-text-2)" }}>加载中…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--family-text)" }}>
            📋 任务看板
          </h1>
          <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
            {groups.length} 个领域 · 待处理 {totalPending} 项 · 已完成 {totalDone} 项
          </p>
        </div>
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          className="btn-rebuild"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={rebuilding ? "animate-spin" : ""}>
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          {rebuilding ? "重建中…" : "重建索引"}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-card">
          <p className="text-sm" style={{ color: "var(--family-text-2)" }}>暂无任务</p>
          <p className="text-xs mt-1" style={{ color: "var(--family-text-3)" }}>
            运行「重建索引」从知识库中提取待办事项
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const pct = group.pending.length + group.done.length > 0
              ? Math.round((group.done.length / (group.pending.length + group.done.length)) * 100)
              : 0;
            return (
              <div key={group.domain} className="task-group">
                <div className="task-group-header">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0">{domainIcon(group.domain)}</span>
                    <h2 className="text-sm font-semibold truncate" style={{ color: "var(--family-text)" }}>
                      {group.domain}
                    </h2>
                    <span className="task-badge">{group.pending.length + group.done.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--family-text-3)" }}>
                    <span>{pct}% 完成</span>
                  </div>
                </div>

                <div className="task-progress-bar">
                  <div className="task-progress-fill" style={{ width: `${pct}%` }} />
                </div>

                {group.pending.length > 0 && (
                  <div className="space-y-0.5 px-1 py-2">
                    {(showAll.has(group.domain) ? group.pending : group.pending.slice(0, 30)).map((task) => (
                      <TaskRow key={task.id} task={task} onToggle={handleToggle} />
                    ))}
                    {group.pending.length > 30 && !showAll.has(group.domain) && (
                      <button
                        onClick={() => setShowAll((prev) => new Set(prev).add(group.domain))}
                        className="show-more-btn"
                      >
                        还有 {group.pending.length - 30} 项待办未显示
                      </button>
                    )}
                  </div>
                )}

                {group.done.length > 0 && (
                  <div className="border-t px-1 py-1" style={{ borderColor: "var(--family-border)" }}>
                    <button
                      onClick={() => toggleCollapse(group.domain)}
                      className="done-toggle-btn"
                    >
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{
                          transform: collapsed.has(group.domain) ? "rotate(-90deg)" : "none",
                          transition: "transform 0.15s",
                        }}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                      已完成 ({group.done.length})
                    </button>
                    {!collapsed.has(group.domain) && (
                      <div className="space-y-0.5 mt-1">
                        {group.done.map((task) => (
                          <TaskRow key={task.id} task={task} onToggle={handleToggle} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {group.pending.length === 0 && group.done.length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs" style={{ color: "var(--family-text-3)" }}>该领域暂无任务</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
