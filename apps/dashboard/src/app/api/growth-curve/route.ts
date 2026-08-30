import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";

export type GrowthRecord = {
  date: string;
  ageDays: number;
  ageLabel: string;
  height: number | null;
  weight: number | null;
  source: string;
};

type GrowthData = {
  measurements?: GrowthRecord[];
};

export async function GET() {
  try {
    const fp = statePath("generated", "growth.json");
    const raw = await readFile(fp, "utf8");
    const data: GrowthData = JSON.parse(raw);
    const records = data.measurements ?? [];

    records.sort((a, b) => a.ageDays - b.ageDays);
    return NextResponse.json(records, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
