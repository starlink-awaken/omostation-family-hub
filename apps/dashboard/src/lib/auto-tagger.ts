import { aiChat } from "@/lib/ai";

export async function autoTag(content: string, existingTags?: string[]): Promise<string[]> {
  try {
    const systemPrompt = "你是一个标签生成器。分析以下家庭文档内容，返回 2-5 个最相关的中文标签。只返回标签名，用逗号分隔，不要序号和解释。";
    const userPrompt = content.slice(0, 2000);

    const result = await aiChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    if (!result || typeof result !== "string") return [];

    const newTags = result
      .split(/[,，、]/u)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 20);

    if (newTags.length === 0) return [];

    const merged = new Set([...(existingTags || []), ...newTags]);
    return Array.from(merged).slice(0, 10);
  } catch {
    return [];
  }
}

export function updateFrontmatterTags(markdown: string, tags: string[]): string {
  const tagLine = `tags: [${tags.join(", ")}]`;
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/u);

  if (frontmatterMatch) {
    const existing = frontmatterMatch[1];
    if (/^tags:/mu.test(existing)) {
      const updated = existing.replace(/^tags:.*$/mu, tagLine);
      return markdown.replace(frontmatterMatch[1], updated);
    }
    const updated = existing + `\n${tagLine}`;
    return markdown.replace(frontmatterMatch[1], updated);
  }

  return `---\n${tagLine}\n---\n${markdown}`;
}
