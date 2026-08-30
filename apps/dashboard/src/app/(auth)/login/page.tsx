import { loginAction } from "./actions";
import { sanitizeNextPath } from "@/lib/auth";

type LoginSearchParams = {
  next?: string | string[];
  error?: string | string[];
};

function getFirstString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<LoginSearchParams>;
}) {
  const resolved = await searchParams;
  const nextRaw = getFirstString(resolved?.next);
  const nextPath = sanitizeNextPath(nextRaw) || "/";
  const errorRaw = getFirstString(resolved?.error) || "";

  const errorText =
    errorRaw === "invalid"
      ? "口令不正确"
      : errorRaw === "missing_config"
        ? "未配置口令（FAMILY_DASHBOARD_PASSWORD）"
        : "";

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--family-bg)", color: "var(--family-text)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6 shadow-sm"
        style={{
          borderColor: "var(--family-border)",
          background: "var(--family-surface)",
        }}
      >
        <h1 className="text-xl font-semibold">登录</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
          输入口令以继续访问家庭驾驶舱
        </p>
        {errorText ? (
          <div
            className="mt-4 rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: "rgba(185, 88, 82, 0.35)",
              background: "rgba(185, 88, 82, 0.10)",
              color: "var(--family-danger)",
            }}
          >
            {errorText}
          </div>
        ) : null}
        <form action={loginAction} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={nextPath} />
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              口令
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: "var(--family-border)",
                background: "var(--family-surface)",
                color: "var(--family-text)",
              }}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              background: "var(--family-primary)",
              color: "var(--family-surface)",
            }}
          >
            进入
          </button>
        </form>
        <p className="mt-4 text-xs" style={{ color: "var(--family-text-3)" }}>
          这是局域网单口令保护，不是账号系统。
        </p>
      </div>
    </main>
  );
}
