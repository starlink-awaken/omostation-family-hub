import Link from "next/link";
import type { HomeToolItem } from "@/types/home";

type Props = {
  items: HomeToolItem[];
};

const ICON_MAP: Record<string, string> = {
  siren: "🚨",
  "file-text": "📄",
  "notebook-pen": "📓",
  wallet: "💰",
  "calendar-heart": "📅",
  "shopping-cart": "🛒",
  "book-open": "📖",
  "calendar-range": "🗓",
  car: "🚗",
  images: "🖼",
};

export function SummaryToolSection({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">工具与模板</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.title}>
            <Link
              href={item.href}
              className="block cockpit-card h-full no-underline"
            >
              <div className="cockpit-card-body">
                <div className="text-lg mb-1">{ICON_MAP[item.icon] ?? "📋"}</div>
                <div className="text-sm font-semibold mb-0">{item.title}</div>
                <div className="text-xs text-surface-3 mt-1">{item.description}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
