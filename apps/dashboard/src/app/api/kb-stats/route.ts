import { readFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { statePath } from "@/lib/paths"

export async function GET() {
  let totalTags = 0
  let topTags: { name: string; count: number }[] = []
  let allDocPaths: string[] = []
  const docMap: Record<string, string> = {}

  try {
    const raw = await readFile(statePath("generated", "tags.json"), "utf8")
    const tagIndex = JSON.parse(raw)
    totalTags = Object.keys(tagIndex.tags || {}).length
    topTags = (Object.entries(tagIndex.tags || {}) as [string, { count: number }][])
      .map(([name, v]) => ({ name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    allDocPaths = (Object.values(tagIndex.docs || {}) as { path: string }[]).map((d) => d.path)
    for (const [, d] of Object.entries(tagIndex.docs || {})) {
      const doc = d as { path: string; title: string };
      docMap[doc.path] = doc.title;
    }
  } catch {}

  let totalLinks = 0
  let topLinked: { path: string; title: string; count: number }[] = []
  let orphanDocs: { path: string; title: string }[] = []

  try {
    const raw = await readFile(statePath("generated", "links.json"), "utf8")
    const linkIndex = JSON.parse(raw)
    const backlinks = linkIndex.backlinks || {}
    totalLinks = (Object.values(backlinks) as unknown[][]).reduce((s, arr) => s + arr.length, 0)

    topLinked = (Object.entries(backlinks) as [string, unknown[]][])
      .map(([docId, arr]) => {
        const docPath = docId.replace(/-/g, "/") + ".md"
        return {
          path: docPath,
          title: docMap[docPath] || docPath.split("/").pop()?.replace(/\.md$/, "") || docPath,
          count: arr.length,
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const referenced = new Set(Object.keys(backlinks))
    orphanDocs = allDocPaths
      .filter(
        (p) =>
          !p.includes("storage/") &&
          !p.includes("99-中转") &&
          !p.includes("_meta/") &&
          !p.includes("_control/"),
      )
      .filter((p) => {
        const docId = p.replace(/[/\\]/g, "-").replace(/\.md$/, "")
        return !referenced.has(docId)
      })
      .map((p) => ({
        path: p,
        title: docMap[p] || p.split("/").pop()?.replace(/\.md$/, "") || p,
      }))
      .slice(0, 20)
  } catch {}

  let totalDocs = 0
  try {
    const raw = await readFile(statePath("generated", "search-index.json"), "utf8")
    const docs = JSON.parse(raw)
    totalDocs = Array.isArray(docs) ? docs.length : 0
  } catch {
    totalDocs = allDocPaths.length
  }

  const recentChanges = 0
  let builtAt: string | null = null
  try {
    const raw = await readFile(statePath("generated", "build-meta.json"), "utf8")
    const meta = JSON.parse(raw)
    builtAt = meta.builtAt || null
  } catch {}

  return NextResponse.json({
    totalDocs,
    totalTags,
    totalLinks,
    topTags,
    topLinked,
    orphanDocs,
    recentChanges,
    builtAt,
  })
}
