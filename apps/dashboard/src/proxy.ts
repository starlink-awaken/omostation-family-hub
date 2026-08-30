import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, isAuthedCookieValue } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/health", "/manifest.json", "/sw.js"]);

function isPublicFile(pathname: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApiPath = pathname.startsWith("/api");

  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname.startsWith("/api/cron")) return NextResponse.next();
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (!isApiPath && isPublicFile(pathname)) return NextResponse.next();
  if (pathname.startsWith("/api/ai")) return NextResponse.next();

  const v = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (isAuthedCookieValue(v)) return NextResponse.next();

  if (isApiPath) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
