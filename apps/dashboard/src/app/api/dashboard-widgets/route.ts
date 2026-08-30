import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export async function GET() {
  let docCount = 0;
  let healthOverview = "";
  let healthPriorities: string[] = [];
  let growthStage = "";
  let growthFocus = "";
  let growthSubtitle = "";
  let recentDocs: { title: string; path: string }[] = [];

  try {
    const raw = await readFile(statePath("generated", "search-index.json"), "utf8");
    const docs = JSON.parse(raw);
    docCount = Array.isArray(docs) ? docs.length : 0;
  } catch {}

  try {
    const raw = await readFile(statePath("generated", "health.json"), "utf8");
    const data = JSON.parse(raw);
    const hs = data.healthSections || {};
    if (hs.overviewSummary) healthOverview = hs.overviewSummary;
    if (hs.overviewTags) healthPriorities = hs.overviewTags;
  } catch {}

  try {
    const raw = await readFile(statePath("generated", "growth.json"), "utf8");
    const data = JSON.parse(raw);
    const gs = data.growthSections || {};
    if (gs.heroSummaries?.length) {
      growthStage = gs.heroSummaries[0]?.value || "";
      growthFocus = gs.heroSummaries[1]?.value || "";
      growthSubtitle = gs.heroSummaries[1]?.subtitle || "";
    }
  } catch {}

  try {
    const raw = await readFile(statePath("generated", "summary.json"), "utf8");
    const data = JSON.parse(raw);
    if (data.recentUpdates) {
      recentDocs = data.recentUpdates.slice(0, 5);
    }
  } catch {}

  return NextResponse.json({
    docCount,
    healthOverview: healthOverview.slice(0, 200),
    healthPriorities,
    growthStage,
    growthFocus,
    growthSubtitle,
    recentDocs,
  });
}
