export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse" style={{ padding: "1.5rem 0" }}>
      <div className="h-5 rounded" style={{ background: "var(--family-surface-2)", width: "40%" }} />
      <div className="h-3 rounded" style={{ background: "var(--family-surface-2)", width: "60%" }} />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
          >
            <div className="h-3 rounded mb-3" style={{ background: "var(--family-surface-2)", width: "70%" }} />
            <div className="h-3 rounded mb-2" style={{ background: "var(--family-surface-2)", width: "90%" }} />
            <div className="h-3 rounded" style={{ background: "var(--family-surface-2)", width: "50%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
