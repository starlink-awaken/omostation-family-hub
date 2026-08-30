import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export type MonthlyCost = {
  month: string;
  total: number;
  count: number;
  items: string[];
};

type ExpenseRecord = {
  date: string;
  item: string;
  amount: string;
  payer: string;
  note: string;
};

type FinanceData = {
  members: unknown[];
  expenses: ExpenseRecord[];
  categories: unknown[];
};

export async function GET() {
  try {
    const fp = path.join(process.cwd(), "app-data", "finance.json");
    const raw = await readFile(fp, "utf8");
    const data: FinanceData = JSON.parse(raw);

    const monthly: Record<string, { total: number; count: number; items: string[] }> = {};

    for (const ex of data.expenses) {
      const month = ex.date.slice(0, 7);
      const amountStr = ex.amount.replace(/[¥,~]/g, "");
      const amount = parseFloat(amountStr) || 0;

      if (!monthly[month]) monthly[month] = { total: 0, count: 0, items: [] };
      monthly[month].total += amount;
      monthly[month].count++;
      monthly[month].items.push(ex.item);
    }

    const result: MonthlyCost[] = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        total: Math.round(data.total),
        count: data.count,
        items: data.items,
      }));

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
