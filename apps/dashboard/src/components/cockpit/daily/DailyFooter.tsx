import type { DailyFooter as DailyFooterType } from "@/types/daily";

type Props = {
  footer: DailyFooterType | null;
};

export function DailyFooter({ footer }: Props) {
  if (!footer) return null;

  return (
    <section className="family-section">
      <div className="strip-card p-3 text-center">
        <h3 className="text-sm font-semibold mb-1">{footer.title}</h3>
        <p className="text-xs text-surface-2 mb-2">{footer.description}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {footer.tags.map((tag, i) => (
            <span key={i} className="badge bg-surface-2 text-xs">{tag}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
