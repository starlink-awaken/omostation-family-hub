import { createHmac } from "node:crypto";

export const AUTH_COOKIE_NAME = "family_dashboard_auth";

function getSigningSecret(): string {
  return process.env.FAMILY_DASHBOARD_PASSWORD || "fallback-dev-only";
}

export function signAuthCookie(): string {
  const payload = `1`;
  const secret = getSigningSecret();
  const sig = createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return `${payload}.${sig}`;
}

export function isAuthedCookieValue(v: string | undefined): boolean {
  if (!v) return false;
  const parts = v.split(".");
  if (parts.length !== 2) return false;
  if (parts[0] !== "1") return false;
  const secret = getSigningSecret();
  const expectedSig = createHmac("sha256", secret)
    .update("1")
    .digest("hex")
    .slice(0, 16);
  return parts[1] === expectedSig;
}

export function getConfiguredPassword(): string | null {
  const raw = process.env.FAMILY_DASHBOARD_PASSWORD;
  const v = typeof raw === "string" ? raw.trim() : "";
  return v ? v : null;
}

export function getCookieTtlDays(): number {
  const raw = process.env.FAMILY_DASHBOARD_COOKIE_TTL_DAYS;
  if (!raw) return 7;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

export function sanitizeNextPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  if (raw.startsWith("/login")) return null;
  return raw;
}
