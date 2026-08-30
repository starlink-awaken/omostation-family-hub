import { loadAppData } from "@/lib/data-loader";
import type { DomainData } from "@/types/domain";
import { GrowthPage } from "@/components/cockpit/GrowthPage";

export const dynamic = "force-dynamic";

export default async function Growth() {
  const data = await loadAppData<DomainData>("growth.json");
  return <GrowthPage data={data} />;
}
