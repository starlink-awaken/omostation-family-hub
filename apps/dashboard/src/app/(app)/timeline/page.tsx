import { loadAppData } from "@/lib/data-loader";
import { TimelineClient } from "./PageClient";

export const dynamic = "force-dynamic";

type Entry = {
  date: string;
  event: string;
  type: string;
  domain?: string;
  related?: string;
};

export default async function TimelinePage() {
  let data: Entry[];
  try {
    data = await loadAppData<Entry[]>("timeline.json");
  } catch {
    data = [];
  }
  return <TimelineClient data={data} />;
}
