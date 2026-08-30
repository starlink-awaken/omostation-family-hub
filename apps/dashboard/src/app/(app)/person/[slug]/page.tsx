import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { marked } from "marked";
import { loadAppData } from "@/lib/data-loader";
import { buildPersonEntries } from "@/lib/person-registry";
import { resolveSsotPath } from "@/lib/ssot";
import { stripFrontmatter } from "@/lib/extract";
import type { DomainData } from "@/types/domain";
import { PersonCardPage } from "@/components/cockpit/person/PersonCardPage";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [];
}

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PersonPage({ params }: Props) {
  const { slug } = await params;
  const data = await loadAppData<DomainData>("members.json");
  const s = data.membersSections;
  if (!s) notFound();

  const entries = buildPersonEntries(s.coreCards);
  const entry = entries.find((e) => e.slug === slug);
  if (!entry) notFound();

  let renderedMd = "";
  try {
    const resolved = resolveSsotPath(entry.sourcePath);
    if (resolved) {
      const raw = await readFile(resolved, "utf8");
      const clean = stripFrontmatter(raw);
      renderedMd = marked.parse(clean, { async: false }) as string;
    }
  } catch {
    renderedMd = "";
  }

  return <PersonCardPage entry={entry} renderedMd={renderedMd} />;
}
