import { loadAppData } from "@/lib/data-loader";
import type { DomainData } from "@/types/domain";
import { DailyPage } from "@/components/cockpit/DailyPage";

export const dynamic = "force-dynamic";

export default async function Daily() {
  const data = await loadAppData<DomainData>("daily.json");
  return <DailyPage data={data} />;
}
