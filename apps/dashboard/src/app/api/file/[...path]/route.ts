import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveSsotPath } from "@/lib/ssot";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".avif", ".bmp", ".ico", ".svg"]);

function isImage(ext: string): boolean {
  return IMAGE_EXTS.has(ext);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segs = (await params).path;
  if (!segs || segs.length === 0) {
    return new NextResponse("missing path", { status: 400 });
  }

  const rel = segs.join("/");
  const resolved = resolveSsotPath(rel);
  if (!resolved) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const ext = path.extname(resolved).toLowerCase();
  try {
    const buffer = await readFile(resolved);
    const mime = MIME[ext] || "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}

export { isImage, IMAGE_EXTS };
