import { readSsotFile, readUniqueSsotFile } from "./common";
import { parseCalendarContent } from "../../src/lib/parsers/calendar-parser";
import { parseFinance, parseBudgetRules } from "../../src/lib/parsers/finance-parser";
import { extractAllTasks } from "../../src/lib/task-extractor";
import { parseFullTimeline, type TimelineEntry } from "../../src/lib/parsers/timeline-parser";
import { parseMilestones } from "../../src/lib/parsers/milestone-parser";
import { parseVaccines } from "../../src/lib/parsers/vaccine-parser";

export async function buildCalendar() {
  try {
    const raw = await readSsotFile("_knowledge/04.家庭日常/06.日历与纪念日/README.md");
    return parseCalendarContent(raw);
  } catch (e) {
    console.warn("build:data calendar skipped:", (e as Error).message);
    return { events: [], periodic: [], reminders: [] };
  }
}

export async function buildTimelineData(): Promise<TimelineEntry[]> {
  try {
    return await parseFullTimeline();
  } catch (e) {
    console.warn("build:data timeline skipped:", (e as Error).message);
    return [];
  }
}

export async function buildFinance() {
  try {
    const [financeRaw, budgetRaw] = await Promise.all([
      readSsotFile("_knowledge/04.家庭日常/04.家庭财务/README.md"),
      readSsotFile("_knowledge/00.规则与模板/家庭账目规则.md"),
    ]);
    const { members, expenses } = parseFinance(financeRaw);
    const categories = parseBudgetRules(budgetRaw);
    return { members, expenses, categories };
  } catch (e) {
    console.warn("build:data finance skipped:", (e as Error).message);
    return { members: [], expenses: [], categories: [] };
  }
}

export async function buildTasks() {
  try {
    return await extractAllTasks();
  } catch (e) {
    console.warn("build:data tasks skipped:", (e as Error).message);
    return [];
  }
}

export async function buildMilestones() {
  try {
    const raw = await readUniqueSsotFile("发育里程碑.md");
    return parseMilestones(raw);
  } catch (e) {
    console.warn("build:data milestones skipped:", (e as Error).message);
    return null;
  }
}

export async function buildVaccines() {
  try {
    const raw = await readUniqueSsotFile("/疫苗接种计划.md");
    return parseVaccines(raw);
  } catch (e) {
    console.warn("build:data vaccines skipped:", (e as Error).message);
    return null;
  }
}
