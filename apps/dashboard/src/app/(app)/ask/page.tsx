import { readFile } from "node:fs/promises";
import path from "node:path";
import AskClient from "@/components/shared/AskClient";
import type { SearchDoc } from "@/lib/search";

export default async function AskPage() {
  let docs: SearchDoc[] = [];
  try {
    const raw = await readFile(
      path.join(process.cwd(), "app-data", "search-index.json"),
      "utf8"
    );
    docs = JSON.parse(raw);
  } catch {}

  return <AskClient initialDocs={docs} />;
}
