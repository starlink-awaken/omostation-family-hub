import { loadAppData } from "@/lib/data-loader";
import { Card } from "@/components/shared/Card";
import type { CalendarEvent, PeriodicEvent, Reminder } from "@/lib/parsers/calendar-parser";

export const dynamic = "force-dynamic";

type CalendarData = {
  events: CalendarEvent[];
  periodic: PeriodicEvent[];
  reminders: Reminder[];
};

function EmptyState() {
  return (
    <Card padding="lg" className="text-center">
      <p className="text-sm mb-0" style={{ color: "var(--family-text-2)" }}>
        暂无日历数据。请先在知识库中添加日历信息。
      </p>
    </Card>
  );
}

const MONTH_ORDER = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];

export default async function CalendarPage() {
  let data: CalendarData;
  try {
    data = await loadAppData<CalendarData>("calendar.json");
  } catch {
    return <EmptyState />;
  }

  const { events, periodic, reminders } = data;

  const grouped: Record<string, { month: string; events: CalendarEvent[] }> = {};
  for (const e of events) {
    const key = e.month;
    if (!grouped[key]) grouped[key] = { month: key, events: [] };
    grouped[key].events.push(e);
  }
  const sortedMonths = MONTH_ORDER.filter((m) => grouped[m]);

  // Default style shapes
  const pill = (bg: string, fg: string) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: "0.75rem",
    fontWeight: 600,
    background: bg,
    color: fg,
  });

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
          🗓️ 日历与纪念日
        </h1>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
          2026 家庭日历 · 生日 · 纪念日 · 定期事务
        </p>
      </div>

      {/* Upcoming section */}
      {reminders.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
            📌 即将到来
          </h2>
          <div className="flex flex-col gap-2">
            {reminders.map((r, i) => {
              const dateMatch = r.date.match(/(\d+)月(\d+)日/);
              const isBirthday = r.event.includes("🎂");
              const isAnniversary = r.event.includes("💍");
              return (
                <Card
                  key={i}
                  padding="md"
                  style={{
                    borderLeft: `3px solid ${isBirthday ? "var(--family-primary)" : isAnniversary ? "var(--family-warning)" : "var(--family-info)"}`,
                  }}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className="shrink-0 flex items-center justify-center rounded-lg font-bold"
                      style={{
                        width: 48,
                        height: 48,
                        background: "var(--family-primary-soft)",
                        color: "var(--family-primary)",
                        fontSize: "1rem",
                      }}
                    >
                      {dateMatch ? dateMatch[2] : r.date}
                    </div>
                    <div className="grow min-w-0">
                      <div className="font-semibold text-sm mb-1" style={{ color: "var(--family-text)" }}>
                        {r.event}
                      </div>
                      {r.suggestion !== "—" && (
                        <div className="text-xs" style={{ color: "var(--family-text-2)" }}>
                          {r.suggestion}
                        </div>
                      )}
                    </div>
                    {dateMatch && (
                      <span className="text-xs shrink-0" style={{ color: "var(--family-text-3)" }}>
                        {dateMatch[1]}月
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Month grid */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
          🎂 生日与纪念日
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedMonths.map((m) => {
            const g = grouped[m];
            return (
              <div key={m}>
                <Card padding="none" className="h-full" style={{ overflow: "hidden" }}>
                  <div
                    className="px-3 py-2 font-semibold text-xs"
                    style={{
                      borderBottom: "1px solid var(--family-border)",
                      color: "var(--family-primary)",
                      background: "var(--family-primary-soft)",
                    }}
                  >
                    {m}
                  </div>
                  <div style={{ padding: "0.625rem 1rem" }}>
                    <div className="flex flex-col gap-2">
                      {g.events.map((ev, idx) => (
                        <div key={idx} className="flex items-center gap-2 py-1">
                          <span style={{ flexShrink: 0, width: 24, textAlign: "center", fontSize: "1rem" }}>
                            {ev.emoji}
                          </span>
                          <div className="min-w-0 grow">
                            <div className="text-xs" style={{ color: "var(--family-text)" }}>
                              <strong>{ev.day}日</strong>&nbsp;
                              {ev.type === "birthday" && (
                                <span style={pill("var(--family-primary-soft)", "var(--family-primary)")}>
                                  生日
                                </span>
                              )}
                              {ev.type === "anniversary" && (
                                <span style={pill("rgba(197, 137, 47, 0.12)", "var(--family-warning)")}>
                                  纪念日
                                </span>
                              )}
                            </div>
                            <div className="text-xs" style={{ color: "var(--family-text-2)", lineHeight: 1.4 }}>
                              {ev.label}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </section>

      {/* Periodic events */}
      {periodic.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
            🔄 定期事务
          </h2>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="table mb-0" style={{ fontSize: "0.8125rem" }}>
                <thead>
                  <tr>
                    <th className="text-xs" style={{ color: "var(--family-text-3)", background: "var(--family-surface-2)", borderColor: "var(--family-border)", padding: "0.625rem 1rem" }}>事项</th>
                    <th className="text-xs" style={{ color: "var(--family-text-3)", background: "var(--family-surface-2)", borderColor: "var(--family-border)", padding: "0.625rem 1rem" }}>时间</th>
                    <th className="text-xs" style={{ color: "var(--family-text-3)", background: "var(--family-surface-2)", borderColor: "var(--family-border)", padding: "0.625rem 1rem" }}>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {periodic.map((p, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--family-text)", borderColor: "var(--family-border)", padding: "0.5rem 1rem" }}>{p.event}</td>
                      <td style={{ color: "var(--family-text-2)", borderColor: "var(--family-border)", padding: "0.5rem 1rem" }}>{p.time}</td>
                      <td style={{ color: "var(--family-text-2)", borderColor: "var(--family-border)", padding: "0.5rem 1rem" }}>{p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* Pending */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
          📝 待补充
        </h2>
        <Card padding="md">
          <div className="flex flex-col gap-2">
            {["王淑慧生日", "张秀英生日", "秦联合生日", "各节日家庭惯例"].map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--family-border)", display: "inline-block" }} />
                <span className="text-xs" style={{ color: "var(--family-text-3)" }}>{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
