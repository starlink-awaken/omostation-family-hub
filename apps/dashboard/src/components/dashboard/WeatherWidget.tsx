"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Weather = {
  city: string;
  temp: string;
  desc: string;
  icon: string;
};

export function WeatherWidget() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((data) => {
        const cc = data.current_condition?.[0];
        if (cc) {
          setWeather({
            city: data.nearest_area?.[0]?.areaName?.[0]?.value || "北京",
            temp: cc.temp_C + "°C",
            desc: cc.weatherDesc?.[0]?.value || "",
            icon: cc.weatherIconUrl?.[0]?.value || "",
          });
        }
      })
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!weather) {
    return (
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)", minHeight: 80 }}>
        <div className="text-xs" style={{ color: "var(--family-text-3)" }}>天气加载中…</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--family-border)", background: "var(--family-surface)" }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--family-text-2)" }}>🌤 天气</div>
          <div className="text-2xl font-bold" style={{ color: "var(--family-text)", lineHeight: 1.2 }}>
            {weather.temp}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--family-text-3)" }}>
            {weather.city} · {weather.desc}
          </div>
        </div>
        {weather.icon && (
          <Image src={weather.icon} alt="天气图标" width={48} height={48} unoptimized style={{ opacity: 0.8 }} />
        )}
      </div>
    </div>
  );
}
