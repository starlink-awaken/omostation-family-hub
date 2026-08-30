import YAML from "yaml";
import { redactText } from "./redact";

export function sanitizeCurrency(text: string): string {
  return text.replace(/¥\s?[\d,.\-~+]+/gu, "¥…");
}

export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---[\s\S]*?---\s*/u, "");
}

export function extractFrontmatter(markdown: string): Record<string, unknown> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/u);
  if (!match) return {};
  try {
    return (YAML.parse(match[1]) as Record<string, unknown> | null) ?? {};
  } catch {
    return {};
  }
}

export function normalizeInlineText(text: string): string {
  return sanitizeCurrency(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/\*\*/gu, "")
    .replace(/`/gu, "")
    .replace(/^[-*]\s+/u, "")
    .trim();
}

function looksLikeFilePointer(text: string): boolean {
  if (!text.startsWith("详见")) return false;
  return /[a-zA-Z0-9_-]+\.(md|pdf|png|jpg|jpeg)\b/u.test(text);
}

function looksLikeFilePointerLine(rawLine: string, normalized: string): boolean {
  if (!normalized.startsWith("详见")) return false;
  if (/\([^)]+\.(md|pdf|png|jpg|jpeg)\)/u.test(rawLine)) return true;
  return looksLikeFilePointer(normalized);
}

export function extractSummaryFromMarkdown(
  markdown: string,
  maxLen = 96,
): string | undefined {
  const frontmatter = extractFrontmatter(markdown);
  const description =
    typeof frontmatter.description === "string" ? frontmatter.description : "";

  const candidates: string[] = [];
  if (description.trim()) candidates.push(description);

  const body = stripFrontmatter(markdown);

  let blockquoteBuf = "";
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const bqMatch = line.match(/^>\s*(.*)/);
    if (bqMatch) {
      const cleaned = normalizeInlineText(bqMatch[1]);
      if (cleaned) blockquoteBuf += (blockquoteBuf ? " · " : "") + cleaned;
      continue;
    }

    if (line.startsWith("---")) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("```") || line.startsWith("|||")) continue;
    if (line.startsWith("|") || line.startsWith("!")) continue;

    const normalized = normalizeInlineText(line);
    if (!normalized) continue;
    if (looksLikeFilePointerLine(line, normalized)) continue;
    if (candidates.length === 0 && blockquoteBuf) {
      candidates.push(blockquoteBuf);
    }
    candidates.push(normalized);
    if (candidates.length >= 3) break;
  }

  if (candidates.length === 0 && blockquoteBuf) {
    candidates.push(blockquoteBuf);
  }

  for (const candidate of candidates) {
    const cleaned = normalizeInlineText(candidate);
    if (!cleaned) continue;
    const result = redactText(cleaned, maxLen);
    if (!result.text) continue;
    if (result.redacted) continue;
    return result.text;
  }

  const fallback = candidates[0] ? normalizeInlineText(candidates[0]) : "";
  const result = redactText(fallback, maxLen);
  return result.text || undefined;
}
