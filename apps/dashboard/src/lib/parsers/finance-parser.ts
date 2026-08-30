export type MemberFinance = {
  name: string;
  income: string;
  asset: string;
};

export type ExpenseRecord = {
  date: string;
  item: string;
  amount: string;
  payer: string;
  note: string;
};

export type BudgetCategory = {
  name: string;
  target: number;
  note: string;
};

export function parseFinance(raw: string) {
  const lines = raw.split("\n");
  const members: MemberFinance[] = [];
  const expenses: ExpenseRecord[] = [];
  let inMember = false;
  let inExpense = false;
  let summaryNote = "";

  for (const line of lines) {
    if (line.startsWith("## 当前快照")) { inMember = true; inExpense = false; continue; }
    if (line.startsWith("## 大件支出记录")) { inMember = false; inExpense = true; continue; }
    if (line.startsWith("---")) continue;
    if (line.startsWith("## ")) { inMember = false; inExpense = false; continue; }
    if (line.startsWith("> ")) { summaryNote = line.replace(/^>\s*/, ""); continue; }

    if (inMember) {
      const mm = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|/);
      if (mm && !line.includes("---") && !line.includes("成员")) {
        members.push({ name: mm[1], income: mm[2], asset: mm[3] });
      }
    }

    if (inExpense) {
      const em = line.match(/^\|\s*(\S+)\s*\|\s*\*{0,2}(.+?)\*{0,2}\s*\|\s*¥?\s*([^|]+?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/);
      if (em && !line.includes("---") && !line.includes("日期")) {
        const rawAmount = em[3].trim();
        const cleanAmount = rawAmount.replace(/^[~\u00a5¥]+\s*/, "");
        const prefix = rawAmount.startsWith("~") ? "~" : "";
        expenses.push({
          date: em[1],
          item: em[2],
          amount: `${prefix}¥${cleanAmount}`,
          payer: em[4],
          note: em[5],
        });
      }
    }
  }

  return { members, expenses, summaryNote };
}

export function parseBudgetRules(raw: string) {
  const lines = raw.split("\n");
  const categories: BudgetCategory[] = [];
  let inCategory = false;
  for (const line of lines) {
    if (line.startsWith("## §1")) { inCategory = true; continue; }
    if (line.startsWith("## §")) { inCategory = false; continue; }
    if (inCategory) {
      const cm = line.match(/^\|\s*(.+?)\s*\|\s*(\d+)%\s*\|\s*(.*?)\s*\|/);
      if (cm && !line.includes("---") && !line.includes("分类")) {
        categories.push({ name: cm[1], target: parseInt(cm[2]), note: cm[3] });
      }
    }
  }
  return categories;
}
