import { readFile } from "node:fs/promises";
import AskClient from "@/components/shared/AskClient";
import { statePath } from "@/lib/paths";
import type { SearchDoc } from "@/lib/search";

export default async function AskPage() {
  let docs: SearchDoc[] = [];
  try {
    const raw = await readFile(
      statePath("generated", "search-index.json"),
      "utf8"
    );
    docs = JSON.parse(raw);
  } catch {}

  return <AskClient initialDocs={docs} />;
}
