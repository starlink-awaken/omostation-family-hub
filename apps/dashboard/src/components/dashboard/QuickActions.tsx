"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const CSRF_TOKEN = process.env.NEXT_PUBLIC_FAMILY_CSRF_TOKEN || "";

export function QuickActions() {
  const [open, setOpen] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const timer = setTimeout(() => document.addEventListener("click", handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [open]);

  function showToastMsg(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  function csrfHeaders(): Record<string, string> {
    return CSRF_TOKEN ? { "x-family-dashboard-csrf": CSRF_TOKEN } : {};
  }

  async function handleQuickAccounting(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description) return;
    setSubmitting(true);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const line = `- ${dateStr} | ¥${amount} | ${description}\n`;

    try {
      let existingContent = "";
      try {
        const readRes = await fetch("/api/file/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "_storage/inbox/快速记账.md" }),
        });
        if (readRes.ok) {
          const data = await readRes.json();
          existingContent = data.content || "";
        }
      } catch {}

      const newContent = existingContent + line;
      const res = await fetch("/api/file/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify({ path: "_storage/inbox/快速记账.md", content: newContent }),
      });

      if (res.ok) {
        showToastMsg("success", `✅ 已记录 ¥${amount} — ${description}`);
        setAmount("");
        setDescription("");
        setShowDialog(false);
      } else {
        showToastMsg("error", "❌ 记账保存失败");
      }
    } catch {
      showToastMsg("error", "❌ 记账保存失败");
    }
    setSubmitting(false);
  }

  async function handleRebuild() {
    setOpen(false);
    try {
      const res = await fetch("/api/rebuild", {
        method: "POST",
        headers: { ...csrfHeaders() },
      });
      if (res.ok) {
        showToastMsg("success", "✅ 索引已重建");
      } else {
        showToastMsg("error", "❌ 索引重建失败");
      }
    } catch {
      showToastMsg("error", "❌ 索引重建失败");
    }
  }

  async function handleRebuildTasks() {
    setOpen(false);
    try {
      const res = await fetch("/api/tasks/rebuild", { method: "POST" });
      if (res.ok) {
        showToastMsg("success", "✅ 任务已重建");
      } else {
        showToastMsg("error", "❌ 任务重建失败");
      }
    } catch {
      showToastMsg("error", "❌ 任务重建失败");
    }
  }

  const actions = [
    { icon: "📝", label: "快速记账", onClick: () => { setShowDialog(true); setOpen(false); } },
    { icon: "📄", label: "新建笔记", onClick: () => { router.push("/edit?new=true"); setOpen(false); } },
    { icon: "🔄", label: "重建索引", onClick: handleRebuild },
    { icon: "📋", label: "重建任务", onClick: handleRebuildTasks },
  ];

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-36 right-4 z-50 rounded-lg px-4 py-2 text-sm shadow-lg family-transition"
          style={{
            background: toast.type === "success" ? "var(--family-primary)" : "rgba(185,88,82,0.9)",
            color: "#fff",
          }}
        >
          {toast.message}
        </div>
      )}

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={() => setShowDialog(false)}
        >
          <div
            className="rounded-2xl border p-5 w-80 shadow-lg"
            style={{
              background: "var(--family-surface)",
              borderColor: "var(--family-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
              📝 快速记账
            </h3>
            <form onSubmit={handleQuickAccounting} className="flex flex-col gap-3">
              <input
                type="number"
                step="0.01"
                placeholder="金额"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none family-transition"
                style={{
                  background: "var(--family-surface)",
                  borderColor: "var(--family-border)",
                  color: "var(--family-text)",
                }}
              />
              <input
                type="text"
                placeholder="品类描述"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none family-transition"
                style={{
                  background: "var(--family-surface)",
                  borderColor: "var(--family-border)",
                  color: "var(--family-text)",
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  className="rounded-lg px-3 py-1.5 text-sm family-transition"
                  style={{
                    background: "var(--family-surface-2)",
                    color: "var(--family-text-2)",
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg px-3 py-1.5 text-sm family-transition"
                  style={{
                    background: "var(--family-primary)",
                    color: "#fff",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div ref={menuRef} className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col items-end gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm family-transition whitespace-nowrap"
                style={{
                  background: "var(--family-surface)",
                  borderColor: "var(--family-border)",
                  color: "var(--family-text)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  cursor: "pointer",
                }}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center rounded-full family-transition border-0"
          style={{
            width: 44,
            height: 44,
            background: "var(--family-primary)",
            color: "#fff",
            fontSize: "1.25rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            cursor: "pointer",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          +
        </button>
      </div>
    </>
  );
}
