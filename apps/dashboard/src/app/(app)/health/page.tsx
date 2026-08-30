import type { DomainData } from "@/types/domain";
import { HealthPage } from "@/components/cockpit/HealthPage";
import { loadAppData } from "@/lib/data-loader";

export const dynamic = "force-dynamic";

export default async function HealthPageRoute() {
  const data = await loadAppData<DomainData | null>("health.json").catch(() => null);

  if (!data) {
    return (
      <div
        className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8"
        style={{ boxShadow: "var(--family-shadow-soft)" }}
      >
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}
        >
          <h1 className="family-h1 text-[38px]">医疗健康</h1>
          <p className="mt-3 text-sm" style={{ color: "var(--family-text-2)" }}>
            暂无数据。请先运行 <code className="font-semibold" style={{ color: "var(--family-text)" }}>bun run build:data</code> 生成健康数据。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8"
      style={{ boxShadow: "var(--family-shadow-soft)" }}
    >
      <HealthPage data={data} />
    </div>
  );
}
