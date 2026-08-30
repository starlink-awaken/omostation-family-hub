"use client";

import { useState } from "react";

export function PushStatusIndicator() {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleTest() {
    setSending(true);
    setMsg("");

    try {
      const res = await fetch("/api/test-push");
      const data = await res.json();
      if (data.ok) {
        setMsg("测试推送已发送，请查看手机通知");
      } else {
        setMsg("推送失败，请检查 Bark Key 配置");
      }
    } catch {
      setMsg("推送失败，请检查 Bark Key 配置");
    }
    setSending(false);
  }

  return (
    <div
      className="fixed bottom-4 right-4 flex items-center gap-2 z-40"
      style={{ fontSize: "0.75rem" }}
    >
      <button
        onClick={handleTest}
        disabled={sending}
        className="border rounded-lg px-3 py-1.5 family-transition flex items-center gap-1.5"
        style={{
          background: "var(--family-surface)",
          borderColor: "var(--family-border)",
          color: "var(--family-text-2)",
          cursor: sending ? "not-allowed" : "pointer",
          opacity: sending ? 0.6 : 1,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
        title="点击测试推送"
      >
        <span>🔔</span>
        {sending ? "发送中…" : "测试推送"}
      </button>
      {msg && (
        <span
          className="rounded-lg px-2 py-1"
          style={{
            background: msg.includes("失败") ? "rgba(185,88,82,0.12)" : "rgba(46,125,50,0.12)",
            color: msg.includes("失败") ? "var(--family-danger)" : "#2e7d32",
          }}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
