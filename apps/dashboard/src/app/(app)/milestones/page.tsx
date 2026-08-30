import { loadAppData } from "@/lib/data-loader";
import type { MilestoneData, VaccineData } from "@/types/milestone";
import { MilestonesClient } from "./milestones-client";

export const dynamic = "force-dynamic";

export default async function MilestonesPage() {
  const [ms, vac] = await Promise.all([
    loadAppData<MilestoneData>("milestones.json").catch(() => null),
    loadAppData<VaccineData>("vaccines.json").catch(() => null),
  ]);

  return <MilestonesClient milestones={ms} vaccines={vac} />;
}
