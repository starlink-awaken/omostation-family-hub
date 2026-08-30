import type {
  MilestoneData,
  MilestoneItem,
  MilestoneStatus,
  MilestoneDomain,
  CheckupReminder,
} from "@/types/milestone";

function parseStatus(sectionTitle: string): MilestoneStatus {
  if (sectionTitle.includes("已达成")) return "achieved";
  if (sectionTitle.includes("观察中")) return "observing";
  if (sectionTitle.includes("即将到来")) return "upcoming";
  return "future";
}

function parseTable(lines: string[], startIdx: number): string[][] {
  const rows: string[][] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) break;
    if (line.startsWith("|") && !line.includes("---")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      rows.push(cells);
    }
    if (line.startsWith("#") || line.startsWith("---")) break;
  }
  return rows;
}

function inferDomain(title: string): MilestoneDomain {
  const known: Record<string, MilestoneDomain> = {
    大运动: "大运动",
    精细运动: "精细运动",
    语言: "语言",
    社交情感: "社交情感",
    认知: "认知",
    喂养: "喂养",
    睡眠: "睡眠",
  };
  return known[title] || "大运动";
}

export function parseMilestones(raw: string): MilestoneData {
  const lines = raw.split("\n");
  const data: MilestoneData = {
    childName: "",
    birthDate: "",
    milestones: [],
    observing: [],
    upcoming: [],
    future: [],
    checkups: [],
    monthlyAlerts: [],
  };

  let currentSection = "";
  let currentStatus: MilestoneStatus = "achieved";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const titleMatch = line.match(/^## (.+)/);
    if (titleMatch) {
      currentSection = titleMatch[1];
      currentStatus = parseStatus(currentSection);
      continue;
    }

    const tableHeader = line.match(/^\|\s*月龄/);
    if (!tableHeader) continue;

    const rows = parseTable(lines, i + 2);
    i += rows.length + 2;

    if (currentSection.includes("里程碑观察提醒")) {
      if (currentSection.includes("近期")) {
        for (const row of rows) {
          if (row.length >= 2) {
            data.monthlyAlerts.push({
              month: row[0],
              alerts: [{ topic: row[1], type: row[2] || "" }],
            });
          }
        }
      }
      if (currentSection.includes("儿保")) {
        for (const row of rows) {
          if (row.length >= 3) {
            data.checkups.push({
              monthLabel: row[0],
              item: row[1],
              suggestedDate: row[2],
            });
          }
        }
      }
      continue;
    }

    for (const row of rows) {
      if (row.length < 3) continue;
      const monthRange = row[0];
      const domain = inferDomain(row[1]);
      const title = row[2];
      let achievedDate: string | null = null;
      let expectedDate: string | null = null;
      let note = row[row.length - 1] || "";
      let important = false;

      if (currentStatus === "achieved") {
        achievedDate = row[3] || null;
        expectedDate = null;
      } else if (currentStatus === "observing") {
        expectedDate = row[3] || null;
        note = row[row.length - 1] || "";
      } else if (currentStatus === "upcoming") {
        expectedDate = row[3] || null;
        important = (row[4] || "").includes("⭐");
      }

      const item: MilestoneItem = {
        id: `ms-${monthRange}-${title.slice(0, 8)}`,
        monthRange,
        domain,
        title,
        achievedDate,
        expectedDate,
        status: currentStatus,
        note,
        important,
      };

      if (currentStatus === "achieved") data.milestones.push(item);
      else if (currentStatus === "observing") data.observing.push(item);
      else if (currentStatus === "upcoming") data.upcoming.push(item);
      else data.future.push(item);
    }
  }

  data.childName = "Synthetic Member 02";
  data.birthDate = "2025-10-16";

  return data;
}
