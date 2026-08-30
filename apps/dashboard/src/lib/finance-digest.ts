import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSsotRoot } from "@/lib/ssot";

export interface FinanceCategory {
  name: string;
  amount: number;
}

export interface FinanceDigest {
  total: number;
  categories: FinanceCategory[];
  date: string;
}

export async function getYesterdayFinanceDigest(): Promise<FinanceDigest | null> {
  try {
    const fp = path.join(getSsotRoot(), "_knowledge/04.家庭日常/04.家庭财务/README.md");
    const raw = await readFile(fp, "utf8");
    const lines = raw.split("\n");

    const expenses: { item: string; amount: number; payer: string }[] = [];
    let inExpense = false;

    for (const line of lines) {
      if (line.startsWith("## 大件支出记录")) { inExpense = true; continue; }
      if (line.startsWith("## ") && !line.startsWith("## 大件支出记录")) { inExpense = false; continue; }
      if (!inExpense) continue;

      const em = line.match(/^\|\s*\S+\s*\|\s*\*{0,2}(.+?)\*{0,2}\s*\|\s*¥?([\d,~]+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/);
      if (em && !line.includes("---") && !line.includes("日期")) {
        expenses.push({
          item: em[1].trim(),
          amount: parseFloat(em[2].replace(/,/g, "")),
          payer: em[3].trim(),
        });
      }
    }

    if (expenses.length === 0) return null;

    const categoryMap = new Map<string, number>();
    for (const e of expenses) {
      const cat = e.payer || "其他";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + e.amount);
    }

    const total = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return {
      total,
      categories: Array.from(categoryMap.entries()).map(([name, amount]) => ({ name, amount })),
      date: yesterday.toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}
