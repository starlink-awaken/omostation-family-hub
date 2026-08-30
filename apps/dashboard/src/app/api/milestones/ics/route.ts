import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export const dynamic = "force-dynamic";

function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET() {
  try {
    const appData = statePath("generated");
    const ms = JSON.parse(await readFile(path.join(appData, "milestones.json"), "utf8"));
    let vac = null;
    try {
      vac = JSON.parse(await readFile(path.join(appData, "vaccines.json"), "utf8"));
    } catch {}

    const now = new Date();
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Family Dashboard//Milestones//CN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Synthetic Member 02·里程碑与疫苗",
      "X-WR-TIMEZONE:Asia/Shanghai",
    ];

    const seen = new Set<string>();

    // 发育里程碑事件
    for (const item of [...(ms.observing || []), ...(ms.upcoming || [])]) {
      if (!item.expectedDate || seen.has(item.id)) continue;
      seen.add(item.id);
      const monthNum = parseInt(item.monthRange.split("-")[0]);
      const eventDate = new Date(ms.birthDate);
      eventDate.setMonth(eventDate.getMonth() + monthNum);
      if (eventDate < now) continue;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:milestone-${item.id}@family-dashboard`);
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(eventDate).slice(0, 8)}`);
      lines.push(`DTEND;VALUE=DATE:${toIcsDate(new Date(eventDate.getTime() + 86400000)).slice(0, 8)}`);
      lines.push(`SUMMARY:🏆 ${escapeIcs(item.title)}`);
      lines.push(`DESCRIPTION:${escapeIcs(item.domain)} · ${item.monthRange}月龄${item.important ? " · ⭐ 重要" : ""}`);
      lines.push(`CATEGORIES:发育里程碑,${item.domain}`);
      if (item.important) lines.push("PRIORITY:1");
      lines.push("END:VEVENT");
    }

    // 疫苗事件
    if (vac) {
      for (const v of vac.vaccines || []) {
        const parts = v.plannedDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!parts) continue;
        const eventDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        if (eventDate < now) continue;

        const isOverdue = v.status === "到期" || v.status === "超期";
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:vaccine-${v.id}@family-dashboard`);
        lines.push(`DTSTART;VALUE=DATE:${toIcsDate(eventDate).slice(0, 8)}`);
        lines.push(`DTEND;VALUE=DATE:${toIcsDate(new Date(eventDate.getTime() + 86400000)).slice(0, 8)}`);
        lines.push(`SUMMARY:💉 ${escapeIcs(v.name)} (${v.dose})`);
        lines.push(`DESCRIPTION:${v.monthLabel} · ${escapeIcs(v.note || v.freeStatus)}${isOverdue ? " · ⚠️ 已超期" : ""}`);
        lines.push(`CATEGORIES:疫苗接种,${v.freeStatus}`);
        if (isOverdue || v.status === "即将到期") lines.push("PRIORITY:1");
        lines.push("END:VEVENT");
      }

      for (const v of vac.optionalVaccines || []) {
        const parts = v.plannedDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!parts) continue;
        const eventDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        if (eventDate < now) continue;

        const monthNumMatch = v.monthLabel.match(/(\d+)\s*月/);
        if (!monthNumMatch) continue;

        const monthNum = parseInt(monthNumMatch[1]) - 1;
        const fallbackDate = new Date(ms.birthDate);
        fallbackDate.setMonth(fallbackDate.getMonth() + monthNum);
        const eventDate2 = eventDate.getTime() > 0 ? eventDate : fallbackDate;
        if (eventDate2 < now) continue;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:vaccine-${v.id}@family-dashboard`);
        lines.push(`DTSTART;VALUE=DATE:${toIcsDate(eventDate2).slice(0, 8)}`);
        lines.push(`DTEND;VALUE=DATE:${toIcsDate(new Date(eventDate2.getTime() + 86400000)).slice(0, 8)}`);
        lines.push(`SUMMARY:💊 ${escapeIcs(v.name)}`);
        lines.push(`DESCRIPTION:${v.monthLabel} · ${escapeIcs(v.note)}`);
        lines.push("CATEGORIES:自费疫苗");
        lines.push("END:VEVENT");
      }

      // 儿保事件
      for (const c of vac.checkups || []) {
        const parts = c.suggestedDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!parts) continue;
        const eventDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        if (eventDate < now) continue;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:checkup-${c.monthLabel}@family-dashboard`);
        lines.push(`DTSTART;VALUE=DATE:${toIcsDate(eventDate).slice(0, 8)}`);
        lines.push(`DTEND;VALUE=DATE:${toIcsDate(new Date(eventDate.getTime() + 86400000)).slice(0, 8)}`);
        lines.push(`SUMMARY:🏥 ${escapeIcs(c.items)}`);
        lines.push(`DESCRIPTION:${c.monthLabel}`);
        lines.push("CATEGORIES:儿保");
        lines.push("END:VEVENT");
      }
    }

    lines.push("END:VCALENDAR");

    return new NextResponse(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="weizhen-milestones-vaccines.ics"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Data not available" }, { status: 503 });
  }
}
