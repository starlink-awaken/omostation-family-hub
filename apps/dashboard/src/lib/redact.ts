const SENSITIVE_PATTERNS: RegExp[] = [
  /\b1\d{10}\b/u,
  /\b\d{17}[\dXx]\b/u,
  /¥\s?\d+(?:[.\d]*)\b/u,
];

const SENSITIVE_WORDS: RegExp[] = [
  /身份证/u,
  /银行卡/u,
  /银行账号/u,
];

export function redactText(
  input: string,
  maxLen = 140,
): { text: string; redacted: boolean } {
  const collapsed = input.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return { text: "", redacted: false };
  }

  let redacted = false;
  let result = collapsed;

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, "◆◆");
      redacted = true;
    }
  }

  for (const pattern of SENSITIVE_WORDS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, "◆◆");
      redacted = true;
    }
  }

  if (redacted || result.length <= maxLen) {
    return { text: result, redacted };
  }

  return {
    text: `${result.slice(0, Math.max(0, maxLen - 1))}…`,
    redacted,
  };
}
