import type { VaccineData, VaccineItem, CheckupItem, VaccineStatus } from "@/types/milestone";

function stripMarkdown(text: string): string {
  return text.replace(/\*+/g, "").trim();
}

function parseTable(lines: string[], startIdx: number): string[][] {
  const rows: string[][] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) break;
    if (line.startsWith("## ")) break;
    if (line.startsWith("|")) {
      // Skip separator rows (e.g. |---|---|)
      if (/^\|[\s\-|+]+\|$/.test(line)) continue;
      const cells = line.split("|").slice(1, -1).map((c) => stripMarkdown(c));
      if (cells.length >= 3) rows.push(cells);
    }
  }
  return rows;
}

function parseStatus(raw: string): VaccineStatus {
  if (raw.includes("已接种") || raw.includes("确认") || raw.includes("已做")) return "确认";
  if (raw.includes("🔴")) return "到期";
  if (raw.includes("🟠")) return "即将到期";
  if (raw.includes("待确认")) return "待确认";
  if (raw.includes("到期")) return "到期";
  if (raw.includes("超期")) return "超期";
  return "待接种";
}

export function parseVaccines(raw: string): VaccineData {
  const lines = raw.split("\n");
  const data: VaccineData = {
    childName: "Synthetic Member 02",
    birthDate: "",
    vaccines: [],
    optionalVaccines: [],
    checkups: [],
  };

  let currentSection = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const hMatch = line.match(/^## (.+)/);
    if (hMatch) {
      currentSection = hMatch[1];
      continue;
    }

    if (line.startsWith("出生日期：")) {
      const bm = line.match(/出生日期：(\d{4}-\d{2}-\d{2})/);
      if (bm) data.birthDate = bm[1];
    }

    const tableStart = line.match(/^\|\s*月龄/);
    if (!tableStart) continue;

    const rows = parseTable(lines, i + 2);
    i += rows.length + 2;

    for (const row of rows) {
      if (currentSection.includes("国家免疫规划")) {
        const item = parseVaccineRow(row, false);
        if (item) data.vaccines.push(item);
      } else if (currentSection.includes("自费")) {
        const item = parseVaccineRow(row, true);
        if (item) data.optionalVaccines.push(item);
      } else if (currentSection.includes("儿保") || currentSection.includes("体检计划")) {
        if (row.length >= 3) {
          data.checkups.push({
            monthLabel: row[0],
            items: row[1],
            suggestedDate: row[2],
            status: row[3] || "⏳",
          });
        }
      }
    }
  }

  return data;
}

function parseVaccineRow(row: string[], isOptional: boolean): VaccineItem | null {
  const freeStatus = isOptional ? "自费" as const : "免费" as const;

  if (isOptional) {
    // 自费疫苗: 月龄 | 疫苗 | 剂次 | 应种日期 | 参考价格 | 建议
    if (row.length >= 3) {
      const plannedDate = row.length >= 4 ? row[3] : "";
      const note = row.length >= 6 ? row[5] : "";
      const isOverdue = (row[4] || "").includes("已过") || note.includes("已过");
      return {
        id: `vac-${row[1]}-${row[0]}`.replace(/\s+/g, "-"),
        monthLabel: row[0],
        name: row[1],
        dose: row[2],
        plannedDate,
        actualDate: null,
        status: isOverdue ? "超期" : "待接种",
        note,
        isOptional: true,
        freeStatus: "自费",
      };
    }
    return null;
  }

  // 规划疫苗: 月龄 | 疫苗 | 剂次 | 应种日期 | 实际接种 | 状态 | 备注
  if (row.length >= 4) {
    const plannedDate = row[3];
    const actualDate = row.length >= 5 && row[4] !== "—" ? row[4] : null;
    const statusRaw = row.length >= 6 ? row[5] : "";
    const status = statusRaw ? parseStatus(statusRaw) : "待接种";
    const note = row.length >= 7 ? row[6] : "";
    return {
      id: `vac-${row[1]}-${row[0]}`.replace(/\s+/g, "-"),
      monthLabel: row[0],
      name: row[1],
      dose: row[2],
      plannedDate,
      actualDate,
      status,
      note,
      isOptional: false,
      freeStatus: "免费",
    };
  }

  return null;
}
