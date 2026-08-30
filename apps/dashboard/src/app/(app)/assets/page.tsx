import { loadAppData } from "@/lib/data-loader";
import type { DomainData } from "@/types/domain";
import { AssetsPage } from "@/components/cockpit/AssetsPage";

export const dynamic = "force-dynamic";

export default async function Assets() {
  const data = await loadAppData<DomainData>("assets.json");
  return <AssetsPage data={data} />;
}
