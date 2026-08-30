import { readFile } from "node:fs/promises";
import path from "node:path";
import { aiChat } from "@/lib/ai";

export interface Anomaly {
  type: "spending_spike" | "health_due" | "task_overdue" | "summary";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
}

function parseMonth(dateStr: string): string | null {
  const m1 = dateStr.match(/^(\d{4})-(\d{1,2})$/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}`;
  const m2 = dateStr.match(/^(\d{4})年(\d{1,2})月$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}`;
  return null;
}

export async function checkAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    const fp = path.join(process.cwd(), "app-data", "finance.json");
    const raw = await readFile(fp, "utf8");
    const financeData = JSON.parse(raw);

    const monthlyTotals = new Map<string, number>();

    if (financeData.monthlyTotals) {
      for (const [month, total] of Object.entries(financeData.monthlyTotals)) {
        monthlyTotals.set(month, total as number);
      }
    } else if (Array.isArray(financeData.records)) {
      for (const record of financeData.records) {
        const month = record.month || (record.date ? parseMonth(record.date) : null);
        if (month) {
          monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + (record.amount || 0));
        }
      }
    }

    const sortedMonths = Array.from(monthlyTotals.keys()).sort();
    if (sortedMonths.length >= 2) {
      const lastMonth = sortedMonths[sortedMonths.length - 1];
      const prevMonth = sortedMonths[sortedMonths.length - 2];
      const lastTotal = monthlyTotals.get(lastMonth) || 0;
      const prevTotal = monthlyTotals.get(prevMonth) || 0;

      if (prevTotal > 0) {
        const ratio = lastTotal / prevTotal;
        const change = Math.abs(ratio - 1);
        if (change > 0.3) {
          const direction = ratio > 1 ? "增长" : "下降";
          anomalies.push({
            type: "spending_spike",
            title: `大件支出${direction}异常`,
            detail: `${lastMonth} 大件支出 ¥${lastTotal.toLocaleString()}，较 ${prevMonth}（¥${prevTotal.toLocaleString()}）${direction} ${(change * 100).toFixed(0)}%`,
            severity: change > 0.5 ? "high" : "medium",
          });
        }
      }
    }
  } catch {
  }

  try {
    const fp = path.join(process.cwd(), "app-data", "health.json");
    const raw = await readFile(fp, "utf8");
    const healthData = JSON.parse(raw);
    const reminders = healthData.reminders || [];
    for (const r of reminders) {
      if (r.daysLeft <= 0) {
        anomalies.push({
          type: "health_due",
          title: `健康提醒已过期：${r.title}`,
          detail: `${r.memberName} · ${r.date} · ${r.type === "vaccination" ? "疫苗接种" : r.type === "medication" ? "用药" : "检查"} · 已过期 ${Math.abs(r.daysLeft)} 天`,
          severity: "high",
        });
      }
    }
  } catch {
  }

  try {
    const fp = path.join(process.cwd(), "app-data", "tasks.json");
    const raw = await readFile(fp, "utf8");
    const tasksData = JSON.parse(raw);
    const allTasks = tasksData.tasks || tasksData.items || [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (const t of allTasks) {
      if (t.done) continue;
      if (!t.dueDate) continue;
      const due = new Date(t.dueDate);
      if (due < now) {
        anomalies.push({
          type: "task_overdue",
          title: `任务已过期：${t.text}`,
          detail: `到期日 ${t.dueDate} · 来源 ${t.sourceTitle}`,
          severity: "medium",
        });
      }
    }
  } catch {
  }

  if (anomalies.length > 0) {
    try {
      const anomalyText = anomalies
        .map((a) => `[${a.severity}] ${a.title}: ${a.detail}`)
        .join("\n");
      const summary = await aiChat([
        {
          role: "system",
          content: "你是一个家庭运营助手。将以下异常检测结果用一句话总结，语气平和、有建设性。",
        },
        {
          role: "user",
          content: anomalyText,
        },
      ]);
      if (summary.trim()) {
        anomalies.push({
          type: "summary",
          title: "AI 总结",
          detail: summary.trim().slice(0, 100),
          severity: "low",
        });
      }
    } catch {
    }
  }

  return anomalies;
}
