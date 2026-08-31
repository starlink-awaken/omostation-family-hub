import path from "node:path";

import { NextResponse } from "next/server";

import { hasValidCsrfHeader } from "@/lib/csrf";
import { stageHitlProposal, submitHitlProposal } from "@/lib/hitl-proposals";

export async function POST(request: Request) {
  if (!hasValidCsrfHeader(request.headers)) {
    return NextResponse.json({ error: "缺少 CSRF 校验" }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { path?: unknown; content?: unknown };
    if (typeof body.path !== "string" || typeof body.content !== "string") {
      return NextResponse.json({ error: "缺少 path 或 content" }, { status: 400 });
    }
    const pending = await submitHitlProposal(
      await stageHitlProposal({
        operation: "replace_text",
        targetRelative: body.path,
        content: body.content,
        summary: `Replace approved family document ${path.posix.basename(body.path)}`,
      }),
    );
    return NextResponse.json({ ...pending, code: "DOCUMENTS_WRITE_PENDING_APPROVAL" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "提案创建失败" }, { status: 409 });
  }
}
