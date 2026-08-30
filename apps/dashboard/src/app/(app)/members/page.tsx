import { loadAppData } from "@/lib/data-loader";
import type { DomainData } from "@/types/domain";
import { MembersPage } from "@/components/cockpit/MembersPage";

export const dynamic = "force-dynamic";

export default async function Members() {
  const data = await loadAppData<DomainData>("members.json");
  return <MembersPage data={data} />;
}
