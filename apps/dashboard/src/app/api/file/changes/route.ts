import { NextResponse } from "next/server"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { getSsotRoot } from "@/lib/ssot"
import { scannablePaths } from "@/lib/task-extractor"

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

async function findChangedMdFiles(root: string): Promise<{ path: string; updatedAt: string }[]> {
  const since = Date.now() - TWENTY_FOUR_HOURS
  const results: { path: string; updatedAt: string }[] = []
  const dirs = scannablePaths().map((p) => path.join(root, p))

  for (const dir of dirs) {
    const stack = [dir]

    while (stack.length > 0) {
      const currentDir = stack.pop()!
      let entries: string[]

      try {
        entries = await readdir(currentDir, { withFileTypes: false })
      } catch {
        continue
      }

      const dirEntries = await Promise.all(
        entries.map(async (name) => {
          if (name.startsWith(".")) return null
          const fullPath = path.join(currentDir, name)
          let entryStat
          try {
            entryStat = await stat(fullPath)
          } catch {
            return null
          }
          return { name, fullPath, isDir: entryStat.isDirectory(), isFile: entryStat.isFile(), mtimeMs: entryStat.mtimeMs }
        })
      )

      for (const entry of dirEntries) {
        if (!entry) continue
        if (entry.isDir) {
          if (entry.name === "_archive") continue
          stack.push(entry.fullPath)
        } else if (entry.isFile && entry.name.endsWith(".md")) {
          if (entry.mtimeMs >= since) {
            const relativePath = path.relative(root, entry.fullPath).split(path.sep).join("/")
            results.push({ path: relativePath, updatedAt: new Date(entry.mtimeMs).toISOString() })
          }
        }
      }
    }
  }

  return results
}

export async function GET(): Promise<NextResponse> {
  const root = getSsotRoot()
  const files = await findChangedMdFiles(root)
  files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return NextResponse.json({
    count: files.length,
    since: new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString(),
    files,
  })
}
