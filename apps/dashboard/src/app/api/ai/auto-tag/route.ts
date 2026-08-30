import { NextResponse } from "next/server";
import { autoTag } from "@/lib/auto-tagger";

export async function POST(request: Request) {
  try {
    const { content, existingTags } = (await request.json()) as {
      content?: string;
      existingTags?: string[];
    };

    if (!content) {
      return NextResponse.json({ error: "缺少 content" }, { status: 400 });
    }

    const tags = await autoTag(content, existingTags);
    return NextResponse.json({ tags });
  } catch {
    return NextResponse.json({ error: "自动标签生成失败" }, { status: 500 });
  }
}
