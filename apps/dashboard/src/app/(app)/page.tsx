import { loadAppData } from "@/lib/data-loader";
import type { SummaryData } from "@/types/summary";
import { HomePage } from "@/components/cockpit/HomePage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await loadAppData<SummaryData>("summary.json");
  return <HomePage data={data} />;
}
