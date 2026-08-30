"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WeatherWidget } from "./WeatherWidget";
import { PushStatusIndicator } from "./PushStatusIndicator";
import { QuickActions } from "./QuickActions";
import { Card } from "@/components/shared/Card";

type DashboardData = {
  docCount: number;
  healthOverview: string;
  healthPriorities: string[];
  growthStage: string;
  growthFocus: string;
  growthSubtitle: string;
  recentDocs: { title: string; path: string }[];
};

export function DashboardWidgets() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard-widgets")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold mb-0" style={{ color: "var(--family-text)" }}>
          📊 家庭看板
        </h2>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}>
          小部件
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Weather */}
        <div key="weather">
          <WeatherWidget />
        </div>

        {/* Health snapshot */}
        <div key="health">
          <Card className="h-full">
            <div className="flex items-center gap-1 mb-2">
              <span style={{ fontSize: "1rem" }}>❤️</span>
              <span className="text-xs font-semibold" style={{ color: "var(--family-text-2)" }}>健康关注</span>
            </div>
            {data ? (
              <>
                <p className="text-xs mb-0 lh-base" style={{ color: "var(--family-text)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {data.healthOverview || "暂无数据"}
                </p>
                {data.healthPriorities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.healthPriorities.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs" style={{ color: "var(--family-text-3)" }}>加载中…</div>
            )}
          </Card>
        </div>

        {/* Growth snapshot */}
        <div key="growth">
          <Card className="h-full">
            <div className="flex items-center gap-1 mb-2">
              <span style={{ fontSize: "1rem" }}>🌱</span>
              <span className="text-xs font-semibold" style={{ color: "var(--family-text-2)" }}>育儿成长</span>
            </div>
            {data ? (
              <>
                {data.growthStage && (
                  <div className="text-lg font-bold mb-0.5" style={{ color: "var(--family-text)" }}>
                    {data.growthStage}
                  </div>
                )}
                {data.growthFocus && (
                  <div className="text-xs mb-0" style={{ color: "var(--family-text-2)" }}>
                    {data.growthFocus}
                    {data.growthSubtitle && (
                      <span className="ml-1" style={{ color: "var(--family-text-3)" }}>
                        · {data.growthSubtitle}
                      </span>
                    )}
                  </div>
                )}
                <Link href="/growth" className="inline-block mt-2 text-xs no-underline" style={{ color: "var(--family-primary)" }}>
                  查看详情 →
                </Link>
              </>
            ) : (
              <div className="text-xs" style={{ color: "var(--family-text-3)" }}>加载中…</div>
            )}
          </Card>
        </div>

        {/* Weekly report */}
        <div key="weekly">
          <Card className="h-full">
            <div className="flex items-center gap-1 mb-2">
              <span style={{ fontSize: "1rem" }}>📋</span>
              <span className="text-xs font-semibold" style={{ color: "var(--family-text-2)" }}>周报</span>
            </div>
            <p className="text-xs mb-0" style={{ color: "var(--family-text-3)" }}>
              AI 自动汇总本周事件、健康、育儿动态
            </p>
            <a
              href="/ask"
              className="inline-block mt-2 text-xs no-underline font-semibold"
              style={{ color: "var(--family-primary)" }}
            >
              生成周报 →
            </a>
          </Card>
        </div>

        {/* Stats */}
        <div key="stats">
          <Card className="h-full">
            <div className="flex items-center gap-1 mb-2">
              <span style={{ fontSize: "1rem" }}>📈</span>
              <span className="text-xs font-semibold" style={{ color: "var(--family-text-2)" }}>知识库</span>
            </div>
            {data ? (
              <>
                <div className="text-lg font-bold mb-0.5" style={{ color: "var(--family-text)" }}>
                  {data.docCount} 篇
                </div>
                {data.recentDocs.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {data.recentDocs.slice(0, 3).map((d) => (
                      <Link
                        key={d.path}
                        href={`/doc?path=${encodeURIComponent(d.path)}`}
                        className="text-xs no-underline truncate"
                        style={{ color: "var(--family-text-3)" }}
                      >
                        {d.title}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs" style={{ color: "var(--family-text-3)" }}>加载中…</div>
            )}
          </Card>
        </div>
      </div>
      <PushStatusIndicator />
      <QuickActions />
    </div>
  );
}
