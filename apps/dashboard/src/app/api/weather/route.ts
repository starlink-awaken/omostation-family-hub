import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://wttr.in/Beijing?format=j1", {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=1800" },
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
