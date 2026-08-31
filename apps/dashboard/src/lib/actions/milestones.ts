"use server";

import { updateVaccineStatus, markMilestoneAchieved } from "@/lib/ssot-writer";

type ActionResult = { ok: false; status?: "pending"; proposalId?: string; error?: string };

export async function vaccinateAction(formData: FormData): Promise<ActionResult> {
  try {
    const name = formData.get("name") as string;
    const dose = formData.get("dose") as string;
    const date = formData.get("date") as string;

    if (!name || !dose || !date) {
      return { ok: false, error: "缺少必填字段" };
    }

    const note = (formData.get("note") as string) || undefined;

    const pending = await updateVaccineStatus(name, dose, date, note);
    return { ok: false, ...pending, error: `已提交审批：${pending.proposalId}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function markAchievedAction(formData: FormData): Promise<ActionResult> {
  try {
    const title = formData.get("title") as string;
    const date = formData.get("date") as string;

    if (!title || !date) {
      return { ok: false, error: "缺少必填字段" };
    }

    const pending = await markMilestoneAchieved(title, date);
    return { ok: false, ...pending, error: `已提交审批：${pending.proposalId}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
