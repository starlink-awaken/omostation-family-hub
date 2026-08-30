import { assertDocumentsWriteDisabled } from "@/lib/write-policy";

export async function updateVaccineStatus(
  matchName: string,
  matchDose: string,
  actualDate: string,
  note?: string,
): Promise<void> {
  void matchName;
  void matchDose;
  void actualDate;
  void note;
  assertDocumentsWriteDisabled();
}

export async function markMilestoneAchieved(
  matchTitle: string,
  achievedDate: string,
): Promise<void> {
  void matchTitle;
  void achievedDate;
  assertDocumentsWriteDisabled();
}
