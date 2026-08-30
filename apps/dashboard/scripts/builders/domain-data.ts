import { loadDomainManifest } from "../../src/lib/manifest";
import { extractSummaryFromMarkdown } from "../../src/lib/extract";
import { assertDomainSchema } from "../../src/lib/schema";
import type { Item, Link } from "../../src/types/common";
import type { DomainData, DomainKey } from "../../src/types/domain";
import { isoNow, readSsotFile } from "./common";
import {
  buildHealthSections,
  buildMembersSections,
  buildGrowthSections,
  buildDailySections,
  buildAssetsSections,
  type GrowthRecord,
} from "./domain-builders";

export async function buildDomainData(domain: DomainKey): Promise<DomainData> {
  const manifest = await loadDomainManifest(domain);
  const generatedAt = isoNow();
  const items: Item[] = [];

  const focus: Item[] = [];
  for (const item of manifest.focus ?? []) {
    const sourceMarkdown = await readSsotFile(item.sourcePath);
    const summary = extractSummaryFromMarkdown(sourceMarkdown, 120);

    focus.push({
      id: item.id,
      title: item.title,
      summary,
      sourcePath: item.sourcePath,
      sourceTitle: item.sourceTitle,
      sensitivity: "private",
    });
  }

  const nextActions: Item[] = [];
  for (const item of manifest.nextActions ?? []) {
    const sourceMarkdown = await readSsotFile(item.sourcePath);
    const summary = extractSummaryFromMarkdown(sourceMarkdown, 120);

    nextActions.push({
      id: item.id,
      title: item.title,
      summary,
      sourcePath: item.sourcePath,
      sourceTitle: item.sourceTitle,
      sensitivity: "private",
    });
  }

  const links: Link[] = (manifest.links ?? []).map((link) => ({
    title: link.title,
    href: link.href,
  }));

  for (const item of manifest.items) {
    const sourceMarkdown = await readSsotFile(item.sourcePath);
    const summary = extractSummaryFromMarkdown(sourceMarkdown, 120);

    items.push({
      id: item.id,
      title: item.title,
      summary,
      sourcePath: item.sourcePath,
      sourceTitle: item.sourceTitle,
      sensitivity: "private",
    });
  }

  const sources = [
    ...new Set(
      [...focus, ...nextActions, ...items]
        .map((item) => item.sourcePath)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  let data: DomainData = {
    meta: {
      schemaVersion: "v1",
      generatedAt,
      sources,
    },
    overview: {
      title: manifest.title,
      description: manifest.description,
      totalCount: items.length,
      sourceCount: sources.length,
    },
    focus,
    nextActions,
    links,
    items,
    updatedAt: generatedAt,
  };

  switch (domain) {
    case "health": {
      const sections = await buildHealthSections();
      data = { ...data, healthSections: sections } as DomainData;
      break;
    }
    case "members": {
      const sections = await buildMembersSections();
      data = { ...data, membersSections: sections } as DomainData;
      break;
    }
    case "growth": {
      const sections = await buildGrowthSections();
      data = { ...data, growthSections: { ...sections }, measurements: sections.measurements } as unknown as DomainData;
      break;
    }
    case "daily": {
      const sections = await buildDailySections();
      data = { ...data, dailySections: sections } as DomainData;
      break;
    }
    case "assets": {
      const sections = await buildAssetsSections();
      data = { ...data, assetsSections: sections } as DomainData;
      break;
    }
  }

  assertDomainSchema(data);
  return data;
}
