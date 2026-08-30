"use server";

import { revalidatePath } from "next/cache";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ssotPath } from "@/lib/ssot";
import { statePath } from "@/lib/paths";
import { updateVaccineStatus, markMilestoneAchieved } from "@/lib/ssot-writer";
import { parseVaccines } from "@/lib/parsers/vaccine-parser";
import { parseMilestones } from "@/lib/parsers/milestone-parser";

const VACCINE_FILE = "_knowledge/02.医疗健康/Synthetic Member 02/疫苗接种计划.md";
const MILESTONE_FILE = "_knowledge/03.育儿成长/Synthetic Member 02发育里程碑.md";
const APP_DATA_DIR = statePath("generated");

async function refreshVaccineJson(): Promise<void> {
  const raw = await readFile(ssotPath(VACCINE_FILE), "utf8");
  const data = parseVaccines(raw);
  await writeFile(
    path.join(APP_DATA_DIR, "vaccines.json"),
    JSON.stringify(data, null, 2) + "\n",
    "utf8",
  );
}

async function refreshMilestoneJson(): Promise<void> {
  const raw = await readFile(ssotPath(MILESTONE_FILE), "utf8");
  const data = parseMilestones(raw);
  await writeFile(
    path.join(APP_DATA_DIR, "milestones.json"),
    JSON.stringify(data, null, 2) + "\n",
    "utf8",
  );
}

export async function vaccinateAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const name = formData.get("name") as string;
    const dose = formData.get("dose") as string;
    const date = formData.get("date") as string;

    if (!name || !dose || !date) {
      return { ok: false, error: "缺少必填字段" };
    }

    const note = (formData.get("note") as string) || undefined;

    await updateVaccineStatus(name, dose, date, note);
    await refreshVaccineJson();
    revalidatePath("/milestones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function markAchievedAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const title = formData.get("title") as string;
    const date = formData.get("date") as string;

    if (!title || !date) {
      return { ok: false, error: "缺少必填字段" };
    }

    await markMilestoneAchieved(title, date);
    await refreshMilestoneJson();
    revalidatePath("/milestones");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
