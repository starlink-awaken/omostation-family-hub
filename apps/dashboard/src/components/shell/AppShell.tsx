import type { ReactNode } from "react";
import { readFile } from "node:fs/promises";
import { TopNav } from "./TopNav";
import { BuildTimestamp } from "./BuildTimestamp";
import { SearchOverlay } from "../search/SearchOverlay";
import type { SearchDoc } from "@/lib/search";
import { statePath } from "@/lib/paths";

export async function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  let searchDocs: SearchDoc[] = [];
  try {
    const raw = await readFile(
      statePath("generated", "search-index.json"),
      "utf8"
    );
    searchDocs = JSON.parse(raw);
  } catch {}

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--family-bg)", color: "var(--family-text)" }}
    >
      <TopNav />
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer
        className="mx-auto flex max-w-[1280px] items-center justify-between border-t px-4 py-4 sm:px-6"
        style={{ borderColor: "var(--family-border)" }}
      >
        <BuildTimestamp />
        <span className="text-xs" style={{ color: "var(--family-text-3)" }}>
          家庭驾驶舱
        </span>
      </footer>
      <SearchOverlay initialDocs={searchDocs} />
    </div>
  );
}
