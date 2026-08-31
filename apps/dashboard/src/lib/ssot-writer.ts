import { readFile } from "node:fs/promises";

import { stageHitlProposal, submitHitlProposal, type PendingWrite } from "@/lib/hitl-proposals";
import { ssotPath } from "@/lib/ssot";

function stripMd(value: string): string {
  return value.replace(/[*_`]/gu, "").trim();
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
  if (cells.every((cell) => /^[-:]+$/u.test(cell))) return null;
  return cells;
}

function requiredTarget(name: "FAMILY_VACCINE_DOCUMENT_RELATIVE" | "FAMILY_MILESTONE_DOCUMENT_RELATIVE"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function renderVaccineUpdate(
  content: string,
  matchName: string,
  matchDose: string,
  actualDate: string,
  note?: string,
): string {
  let found = false;
  const updated = content.split("\n").map((line) => {
    const cells = parseTableRow(line);
    if (!cells || stripMd(cells[1]) !== stripMd(matchName) || stripMd(cells[2]) !== stripMd(matchDose)) return line;
    found = true;
    cells[4] = actualDate;
    cells[5] = "✅ 已接种";
    if (note !== undefined) cells[6] = note;
    return `| ${cells.join(" | ")} |`;
  });
  if (!found) throw new Error("疫苗未找到");
  return updated.join("\n");
}

export async function updateVaccineStatus(
  matchName: string,
  matchDose: string,
  actualDate: string,
  note?: string,
): Promise<PendingWrite> {
  const relative = requiredTarget("FAMILY_VACCINE_DOCUMENT_RELATIVE");
  const current = await readFile(ssotPath(relative), "utf8");
  return submitHitlProposal(
    await stageHitlProposal({
      operation: "vaccine_update",
      targetRelative: relative,
      content: renderVaccineUpdate(current, matchName, matchDose, actualDate, note),
      summary: `Record approved vaccine dose ${stripMd(matchDose)}`,
    }),
  );
}

function transformMilestoneTable(content: string, normalizedTitle: string, achievedDate: string): string {
  const lines = content.split("\n");
  let section = "";
  let removed: string[] | null = null;
  let removedIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      section = lines[index];
      continue;
    }
    if (section.includes("已达成里程碑")) continue;
    const cells = parseTableRow(lines[index]);
    if (!cells || stripMd(cells[2]) !== normalizedTitle) continue;
    removed = [cells[0], cells[1], normalizedTitle];
    removedIndex = index;
    break;
  }
  if (!removed || removedIndex < 0) throw new Error("里程碑未找到");
  lines.splice(removedIndex, 1);
  const newRow = `| ${removed[0]} | ${removed[1]} | ${removed[2]} | ${achievedDate} | ✅ |`;
  const achievedStart = lines.findIndex((line) => line.startsWith("## 已达成里程碑"));
  if (achievedStart < 0) {
    const header = `## 已达成里程碑\n\n### 当前新增\n\n| 月龄 | 领域 | 里程碑 | 达成日期 | 备注 |\n|------|------|--------|----------|------|\n${newRow}`;
    lines.splice(1, 0, "", header);
  } else {
    let insertAt = achievedStart + 1;
    for (let index = achievedStart + 1; index < lines.length; index += 1) {
      if (lines[index].startsWith("## ") && !lines[index].startsWith("### ")) break;
      if (parseTableRow(lines[index])) insertAt = index + 1;
    }
    lines.splice(insertAt, 0, newRow);
  }
  return lines.join("\n");
}

export function renderMilestoneAchievement(content: string, matchTitle: string, achievedDate: string): string {
  return transformMilestoneTable(content, stripMd(matchTitle), achievedDate);
}

export async function markMilestoneAchieved(matchTitle: string, achievedDate: string): Promise<PendingWrite> {
  const relative = requiredTarget("FAMILY_MILESTONE_DOCUMENT_RELATIVE");
  const current = await readFile(ssotPath(relative), "utf8");
  return submitHitlProposal(
    await stageHitlProposal({
      operation: "milestone_achieve",
      targetRelative: relative,
      content: renderMilestoneAchievement(current, matchTitle, achievedDate),
      summary: "Record approved milestone achievement",
    }),
  );
}
