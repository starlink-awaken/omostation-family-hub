import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ssotPath } from "@/lib/ssot";

const VACCINE_FILE = "_knowledge/02.医疗健康/Synthetic Member 02/疫苗接种计划.md";
const MILESTONE_FILE = "_knowledge/03.育儿成长/Synthetic Member 02发育里程碑.md";

function stripMd(text: string): string {
  return text.replace(/\*+/g, "").trim();
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  if (trimmed.includes("---") || /^\|月龄/.test(trimmed)) return null;
  const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
  if (cells.length < 3) return null;
  return cells;
}

export async function updateVaccineStatus(
  matchName: string,
  matchDose: string,
  actualDate: string,
  note?: string,
): Promise<void> {
  const filePath = ssotPath(VACCINE_FILE);
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");

  const normName = stripMd(matchName);
  const normDose = stripMd(matchDose);
  let found = false;

  const updated = lines.map((line) => {
    const cells = parseTableRow(line);
    if (!cells) return line;

    const cellName = stripMd(cells[1]);
    const cellDose = stripMd(cells[2]);
    if (cellName !== normName || cellDose !== normDose) return line;

    found = true;
    cells[4] = actualDate;
    cells[5] = "✅ 已接种";
    if (note !== undefined) cells[6] = note;
    else if (/超期/.test(cells[6])) cells[6] = "";
    return "| " + cells.join(" | ") + " |";
  });

  if (!found) {
    throw new Error(`疫苗未找到: ${normName} ${normDose}`);
  }

  await writeFile(filePath, updated.join("\n"), "utf8");
}

export async function markMilestoneAchieved(
  matchTitle: string,
  achievedDate: string,
): Promise<void> {
  const filePath = ssotPath(MILESTONE_FILE);
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");

  const normTitle = stripMd(matchTitle);
  let removedCells: string[] | null = null;
  let removedIdx = -1;

  // Phase 1: find and remove the milestone row in non-achieved sections
  let currentSection = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      currentSection = line;
      continue;
    }
    if (currentSection.includes("已达成里程碑")) continue;

    const cells = parseTableRow(line);
    if (!cells || cells.length < 3) continue;

    const cellTitle = stripMd(cells[2]);
    if (cellTitle !== normTitle) continue;

    const ageGroup = cells[0];
    const domain = cells[1];
    removedCells = [ageGroup, domain, normTitle];
    removedIdx = i;
    break;
  }

  if (!removedCells || removedIdx === -1) {
    throw new Error(`里程碑未找到: ${normTitle}`);
  }

  // Remove the row from its current section
  lines.splice(removedIdx, 1);

  // Phase 2: append to appropriate age sub-section under "已达成里程碑"
  const newRow = `| ${removedCells[0]} | ${removedCells[1]} | ${removedCells[2]} | ${achievedDate} | ✅ |`;

  // Find the achieved section and last table row within it
  let achievedStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## 已达成里程碑")) {
      achievedStart = i;
      break;
    }
  }

  if (achievedStart === -1) {
    // No achieved section — create one at the top of the file
    const header = "## 已达成里程碑\n\n### 当前新增\n\n| 月龄 | 领域 | 里程碑 | 达成日期 | 备注 |\n|------|------|--------|----------|------|\n" + newRow;
    lines.splice(1, 0, "", header);
  } else {
    // Find insertion point: after the last data row inside the achieved section
    let insertAt = achievedStart + 1;
    for (let i = achievedStart + 1; i < lines.length; i++) {
      if (lines[i].startsWith("## ") && !lines[i].startsWith("### ")) break;
      const row = parseTableRow(lines[i]);
      if (row) insertAt = i + 1;
    }
    lines.splice(insertAt, 0, newRow);
  }

  await writeFile(filePath, lines.join("\n"), "utf8");
}
