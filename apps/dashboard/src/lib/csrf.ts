export const FAMILY_CSRF_HEADER = "x-family-dashboard-csrf";

const LOCAL_DEV_CSRF_TOKEN = "family-dashboard-write";

export function getFamilyCsrfToken(): string {
  const configured =
    process.env.NEXT_PUBLIC_FAMILY_CSRF_TOKEN ||
    process.env.FAMILY_CSRF_TOKEN ||
    "";
  const token = configured.trim();
  if (token) return token;
  if (process.env.NODE_ENV !== "production") return LOCAL_DEV_CSRF_TOKEN;
  return "";
}

export function csrfHeaders(): Record<string, string> {
  const token = getFamilyCsrfToken();
  return token ? { [FAMILY_CSRF_HEADER]: token } : {};
}

export function hasValidCsrfHeader(headers: Headers): boolean {
  const token = getFamilyCsrfToken();
  return Boolean(token) && headers.get(FAMILY_CSRF_HEADER) === token;
}
