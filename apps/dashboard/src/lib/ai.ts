import { redactText } from "./redact";

export const AI_CONFIG = {
  gateway: process.env.FAMILY_AI_GATEWAY || process.env.AI_GATEWAY_URL || "",
  models: {
    chat: process.env.FAMILY_AI_CHAT_MODEL || "fast",
    fast: process.env.FAMILY_AI_FAST_MODEL || "fast",
    deep: process.env.FAMILY_AI_DEEP_MODEL || "reasoner",
    embed: process.env.FAMILY_AI_EMBED_MODEL || "embed",
  },
};

const FALLBACK_CHAIN = [
  AI_CONFIG.models.chat,
  process.env.FAMILY_AI_FALLBACK_MODEL_1 || "mini-9b",
  process.env.FAMILY_AI_FALLBACK_MODEL_2 || "mid",
];

function getAiGateway(): string {
  const gateway = AI_CONFIG.gateway.trim().replace(/\/+$/u, "");
  if (!gateway) {
    throw new Error("FAMILY_AI_GATEWAY 未配置");
  }
  return gateway;
}

function shouldRedactBeforeAi(): boolean {
  return process.env.FAMILY_AI_REDACT_CONTEXT !== "false";
}

function sanitizeMessages(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
) {
  if (!shouldRedactBeforeAi()) return messages;
  return messages.map((message) => ({
    ...message,
    content: redactText(message.content, 12000).text,
  }));
}

export async function aiChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { model?: string; stream?: boolean; temperature?: number }
) {
  const models = options?.model
    ? [options.model]
    : FALLBACK_CHAIN;
  const gateway = getAiGateway();
  const safeMessages = sanitizeMessages(messages);

  let lastErr: Error | null = null;
  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const res = await fetch(`${gateway}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: safeMessages,
          stream: options?.stream ?? false,
          temperature: options?.temperature ?? 0.3,
          max_tokens: 8192,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 400 && (body.includes("Model unloaded") || body.includes("No models loaded"))) {
          lastErr = new Error(`Model ${model} unloaded`);
          continue;
        }
        throw new Error(`AI API error (${res.status}): ${body.slice(0, 200)}`);
      }

      if (options?.stream) return res;

      const data = await res.json();
      const msg = data.choices?.[0]?.message || {};
      const content = msg.content || "";
      if (!content.trim() || content.length < 3) {
        lastErr = new Error(`Model ${model} returned empty response`);
        continue;
      }
      return content;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (e.message.includes("unloaded") || e.message.includes("Connection error") || e.message.includes("InternalServerError") || e.message.includes("No models loaded")) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  throw lastErr || new Error("所有模型均不可用");
}

export async function aiStreamChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { model?: string; temperature?: number }
) {
  return aiChat(messages, { ...options, stream: true });
}

export async function aiEmbed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const gateway = getAiGateway();
  const safeTexts = shouldRedactBeforeAi()
    ? texts.map((text) => redactText(text, 12000).text)
    : texts;

  const res = await fetch(`${gateway}/v1/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_CONFIG.models.embed,
      input: safeTexts,
    }),
  });

  if (!res.ok) throw new Error(`Embed API error (${res.status})`);

  const data = await res.json();
  return (data.data || []).map((d: { embedding: number[] }) => d.embedding);
}
