export type CalendarEvent = {
  month: string;
  day: number;
  type: "birthday" | "anniversary" | "other";
  label: string;
  detail: string;
  emoji: string;
};

export type PeriodicEvent = {
  event: string;
  time: string;
  note: string;
};

export type Reminder = {
  date: string;
  event: string;
  suggestion: string;
};

export function parseCalendarContent(raw: string) {
  const lines = raw.split("\n");
  const events: CalendarEvent[] = [];
  const periodic: PeriodicEvent[] = [];
  const reminders: Reminder[] = [];
  let currentMonth = "";
  let inPeriodic = false;
  let inReminder = false;

  for (const line of lines) {
    const mm = line.match(/^### (.+)月$/);
    if (mm) {
      currentMonth = `${mm[1]}月`;
      inPeriodic = false;
      inReminder = false;
      continue;
    }
    if (line.startsWith("### 定期事件")) { inPeriodic = true; inReminder = false; continue; }
    if (line.startsWith("## 2026 年度提醒")) { inPeriodic = false; inReminder = true; continue; }
    if (line.startsWith("---")) continue;
    if (line.startsWith("## ")) { inPeriodic = false; inReminder = false; continue; }

    if (inPeriodic) {
      const pm = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|/);
      if (pm && !line.includes("---") && !line.includes("事项")) {
        periodic.push({ event: pm[1], time: pm[2], note: pm[3] || "—" });
      }
    }

    if (inReminder) {
      const rm = line.match(/^\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|/);
      if (rm && !line.includes("---") && !line.includes("日期")) {
        reminders.push({ date: rm[1], event: rm[2], suggestion: rm[3] || "—" });
      }
    }

    if (currentMonth && !inPeriodic && !inReminder) {
      const em = line.match(/^-\s*\*{0,2}(\d+)日?\*{0,2}\s*([🎂🏦💍🎉🔔⚠️💡]?)\s*(.+)/);
      if (em) {
        const day = parseInt(em[1]);
        const emoji = em[2] || "📌";
        const rest = em[3];
        let type: CalendarEvent["type"] = "other";
        if (emoji === "🎂") type = "birthday";
        else if (emoji === "💍") type = "anniversary";
        events.push({
          month: currentMonth,
          day,
          type,
          label: rest,
          detail: rest,
          emoji,
        });
      }
    }
  }

  return { events, periodic, reminders };
}
